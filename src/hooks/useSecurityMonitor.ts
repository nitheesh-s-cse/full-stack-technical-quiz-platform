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

export function useSecurityMonitor({ enabled, round, getCurrentQuestionId, onServerResponse }: Options) {
  const lastSentRef = useRef<Record<string, number>>({});
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;

    const report = async (eventType: MalpracticeEventType, metadata?: Record<string, unknown>) => {
      const now = Date.now();
      const last = lastSentRef.current[eventType] ?? 0;
      if (now - last < DEDUPE_MS) return;
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
        report("TAB_SWITCH");
      }
    };

    const onBlur = () => {
      if (document.hidden) return;
      report("WINDOW_BLUR");
    };

    const onFullscreenChange = () => {
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
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    // Best-effort DevTools viewport heuristic — inherently bypassable, so we
    // only use it as one weak, low-confidence signal among many.
    const devtoolsInterval = setInterval(() => {
      const threshold = 180;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > threshold || heightDiff > threshold) {
        report("DEVTOOLS_SIGNAL", { widthDiff, heightDiff, heuristic: "viewport" });
      }
    }, 3000);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("selectstart", onSelectStart);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearInterval(devtoolsInterval);
    };
  }, [enabled, round, getCurrentQuestionId, onServerResponse]);
}
