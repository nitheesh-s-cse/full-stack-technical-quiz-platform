"use client";

import { AlertTriangle, LogIn, PlayCircle, CheckCircle2, ShieldX, Settings } from "lucide-react";
import type { LiveEvent } from "@/lib/events";

const ICONS: Record<string, React.ReactNode> = {
  MALPRACTICE: <AlertTriangle className="h-4 w-4 text-red-400" />,
  TEAM_LOGIN: <LogIn className="h-4 w-4 text-sky-400" />,
  QUIZ_STARTED: <PlayCircle className="h-4 w-4 text-emerald-400" />,
  QUIZ_SUBMITTED: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  TERMINATED: <ShieldX className="h-4 w-4 text-red-500" />,
  SETTINGS_UPDATED: <Settings className="h-4 w-4 text-slate-400" />,
};

export default function AlertsFeed({ events }: { events: LiveEvent[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Live Activity</h3>
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {events.length === 0 && <p className="text-sm text-slate-600">No activity yet.</p>}
        {events.map((e, i) => (
          <div
            key={i}
            className={[
              "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs fade-in",
              e.type === "MALPRACTICE" || e.type === "TERMINATED"
                ? "border-red-500/30 bg-red-500/5"
                : "border-slate-800 bg-slate-950/60",
            ].join(" ")}
          >
            <span className="mt-0.5 shrink-0">{ICONS[e.type] ?? <Settings className="h-4 w-4 text-slate-500" />}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-200">{e.message ?? e.type}</p>
              <p className="text-[10px] text-slate-500">
                {e.teamName ? `${e.teamName} · ` : ""}
                {new Date(e.at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
