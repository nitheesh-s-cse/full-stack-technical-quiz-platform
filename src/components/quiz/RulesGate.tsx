"use client";

import { useEffect, useState } from "react";
import { Maximize, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";

type Props = {
  round: number;
  teamName: string;
  durationMinutes: number;
  questionCount: number;
  onStart: () => Promise<void> | void;
};

export default function RulesGate({ round, teamName, durationMinutes, questionCount, onStart }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setError("Your browser blocked fullscreen mode. Please allow it and try again.");
    }
  }

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      await onStart();
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 fade-in">
        <h1 className="text-2xl font-bold text-white">Round {round} — Ready to begin, {teamName}?</h1>
        <p className="mt-1 text-sm text-slate-500">
          {questionCount} questions · {durationMinutes} minutes · server-timed &amp; server-scored
        </p>

        <div className="mt-6 space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" /> Security &amp; Fair-Play Notice</p>
          <ul className="ml-6 list-disc space-y-1 text-amber-200/90">
            <li>Right-click, copy, cut, and paste are disabled and logged.</li>
            <li>Switching tabs, minimizing, or losing window focus is logged.</li>
            <li>Exiting fullscreen during the quiz is logged.</li>
            <li>Developer-tool shortcuts are blocked and logged where detectable.</li>
            <li><strong>3 confirmed violations will disqualify your team immediately.</strong></li>
          </ul>
          <p className="text-xs text-amber-200/70">
            Note: browser-based detection is best-effort. It cannot detect every possible way of viewing another
            screen or capturing it, but all detectable signals are recorded and reviewed by the admin team.
          </p>
        </div>

        <div className="mt-6 space-y-2 text-sm text-slate-400">
          <p>• Your team discusses internally and submits ONE answer per question.</p>
          <p>• The timer is server-controlled — refreshing the page will NOT reset it.</p>
          <p>• Submitting is final. You cannot re-attempt this round.</p>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {!isFullscreen ? (
            <button
              onClick={enterFullscreen}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-5 py-3 font-semibold text-slate-100 transition hover:border-slate-500"
            >
              <Maximize className="h-4 w-4" /> ENTER FULLSCREEN
            </button>
          ) : (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Fullscreen Active
            </div>
          )}
          <button
            onClick={handleStart}
            disabled={!isFullscreen || starting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {starting && <Loader2 className="h-4 w-4 animate-spin" />}
            START QUIZ
          </button>
        </div>
      </div>
    </div>
  );
}
