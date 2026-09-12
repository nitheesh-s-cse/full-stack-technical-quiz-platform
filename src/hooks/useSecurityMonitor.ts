"use client";

import { useEffect, useRef } from "react";
import type { MalpracticeEventType } from "@/lib/constants";

type SecurityResponse = { malpracticeCount: number; terminated: boolean; throttled?: boolean };

type Options = {
  enabled: boolean;
  round: number;
  getCurrentQuestionId: () => number | null;
  onServerResponse: (eventType: MalpracticeEventType, res: SecurityResponse) => void;
};

const DEDUPE_MS = 1200;
const EXIT_COOLDOWN_MS = 3500;
const BLUR_DEBOUNCE_MS = 400;
const EXIT_EVENT_TYPES: readonly MalpracticeEventType[] = ["TAB_SWITCH", "WINDOW_BLUR", "FULLSCREEN_EXIT"];

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || "";
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const hasCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  return Boolean(isMobileUA || (hasCoarsePointer && hasTouch));
}

export function useSecurityMonitor({ enabled, round, getCurrentQuestionId, onServerResponse }: Options) {
  const lastSentRef = useRef<Record<string, number>>({});
  const lastExitSentRef = useRef<number>(0);
  const blurTimerRef = useRef<NodeJS.Timeout | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;

    const report = async (eventType: MalpracticeEventType, metadata?: Record<string, unknown>) => {
      const now = Date.now();
      const last = lastSentRef.current[eventType] ?? 0;
      if (now - last < DEDUPE_MS) return;

      const isExit = EXIT_EVENT_TYPES.includes(eventType);
      if (isExit) {
        if (now - lastExitSentRef.current < EXIT_COOLDOWN_MS) return;
        lastExitSentRef.current = now;
      }

      lastSentRef.current[eventType] = now;

      try {
        const res = await fetch("/api/security/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            round,
            eventType,
            questionId: getCurrentQuestionId(),
            metadata,
          }),
          keepalive: true,
        });
        if (res.ok) {
          const data: SecurityResponse = await res.json();
          onServerResponse(eventType, data);
        }
      } catch {
        // Network failure — the server remains authoritative; we simply
        // couldn't log this particular signal right now.
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      // Right-click is prevented to disable context menu, but is NOT considered or reported as malpractice.
    };

    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      report("COPY_ATTEMPT");
    };
    const onCut = (e: ClipboardEvent) => {
      e.preventDefault();
      report("CUT_ATTEMPT");
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      report("PASTE_ATTEMPT");
    };

    const onSelectStart = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      e.preventDefault();
    };

    const onDragStart = (e: DragEvent) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const combo =
        key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C", "i", "j", "c"].includes(key)) ||
        (e.metaKey && e.altKey && ["I", "J", "C", "i", "j", "c"].includes(key)) ||
        (e.ctrlKey && ["u", "U"].includes(key));

      if (combo) {
        e.preventDefault();
        report("DEVTOOLS_SIGNAL", { key, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey });
        return;
      }

      if (key === "PrintScreen") {
        report("SCREEN_CAPTURE_SIGNAL", { key });
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        // Tab or mobile app was switched away/backgrounded.
        // Cancel any pending blur timer to avoid double-reporting both BLUR and TAB_SWITCH.
        if (blurTimerRef.current) {
          clearTimeout(blurTimerRef.current);
          blurTimerRef.current = null;
        }
        report("TAB_SWITCH");
      }
    };

    const onBlur = () => {
      // If the document is already hidden, visibilitychange handles it as TAB_SWITCH.
      if (document.hidden) return;

      // On mobile devices, isolated blur without document.hidden is almost always
      // a system overlay, notification tray swipe, incoming call, or virtual keyboard.
      // Real app navigation is captured by visibilitychange ("TAB_SWITCH").
      if (isMobileDevice()) return;

      // On desktop, debounce blur to verify if visibilitychange fires immediately after.
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
      }

      blurTimerRef.current = setTimeout(() => {
        blurTimerRef.current = null;
        if (!document.hidden) {
          report("WINDOW_BLUR");
        }
      }, BLUR_DEBOUNCE_MS);
    };

    const onFocus = () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
    };

    const onFullscreenChange = () => {
      // If the document is hidden or transitioning to hidden (e.g. mobile home screen),
      // exiting fullscreen is an automatic browser side-effect of leaving the page.
      if (document.hidden) return;
      if (!document.fullscreenElement) {
        report("FULLSCREEN_EXIT");
      }
    };

    const onBeforeUnload = () => {
      report("NAVIGATION_ATTEMPT");
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    document.addEventListener("selectstart", onSelectStart);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    // Best-effort DevTools viewport heuristic — inherently bypassable, so we
    // only use it as one weak, low-confidence signal among many.
    // Skip on mobile devices since address bars, virtual keyboards, and system UI scale diffs cause false positives.
    let devtoolsInterval: NodeJS.Timeout | null = null;
    if (!isMobileDevice()) {
      devtoolsInterval = setInterval(() => {
        const threshold = 180;
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        if (widthDiff > threshold || heightDiff > threshold) {
          report("DEVTOOLS_SIGNAL", { widthDiff, heightDiff, heuristic: "viewport" });
        }
      }, 3000);
    }

    return () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
      if (devtoolsInterval) {
        clearInterval(devtoolsInterval);
      }
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("selectstart", onSelectStart);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [enabled, round, getCurrentQuestionId, onServerResponse]);
}
