"use client";

import { useState } from "react";
import { X, ShieldCheck, RefreshCw, Play, AlertCircle } from "lucide-react";

export type ReinstateTarget = {
  id: number;
  teamName: string;
  teamCode: string;
  currentRound?: number;
};

export default function ReinstateModal({
  target,
  onClose,
  onReinstated,
}: {
  target: ReinstateTarget | null;
  onClose: () => void;
  onReinstated: () => void;
}) {
  const [mode, setMode] = useState<"restart" | "resume">("restart");
  const [extraMinutes, setExtraMinutes] = useState(15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!target) return null;

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams/${target!.id}/reinstate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          extraMinutes: mode === "resume" ? Number(extraMinutes) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to reinstate team.");
        return;
      }
      onReinstated();
      onClose();
    } catch {
      setError("Network error while reinstating team.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Give Another Chance</h3>
              <p className="text-xs text-slate-400">
                Pardon strikes & re-activate <span className="font-semibold text-slate-200">{target.teamName}</span> ({target.teamCode})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs text-slate-300">
            Choose how you want to restore access for this team:
          </p>

          {/* Option 1: Restart Fresh */}
          <div
            onClick={() => setMode("restart")}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              mode === "restart"
                ? "border-emerald-500/60 bg-emerald-950/20 ring-1 ring-emerald-500/40"
                : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                  mode === "restart" ? "border-emerald-400 bg-emerald-400 text-slate-950" : "border-slate-600"
                }`}
              >
                {mode === "restart" && <div className="h-2 w-2 rounded-full bg-slate-950" />}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">Restart Round (Fresh Attempt)</span>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    RECOMMENDED
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Resets strikes to 0/3, clears answers, and gives full duration timer. The team logs in at{" "}
                  <code className="rounded bg-slate-800 px-1 text-[11px] text-slate-300">/quiz</code> and starts fresh.
                </p>
              </div>
            </div>
          </div>

          {/* Option 2: Resume Session */}
          <div
            onClick={() => setMode("resume")}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              mode === "resume"
                ? "border-sky-500/60 bg-sky-950/20 ring-1 ring-sky-500/40"
                : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                  mode === "resume" ? "border-sky-400 bg-sky-400 text-slate-950" : "border-slate-600"
                }`}
              >
                {mode === "resume" && <div className="h-2 w-2 rounded-full bg-slate-950" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5 text-sky-400" />
                  <span className="text-sm font-semibold text-white">Resume Session (Keep Progress)</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Pardons strikes back to 0/3 and re-activates their session so previous answers are retained.
                </p>

                {mode === "resume" && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-900/80 p-2.5">
                    <label className="text-xs text-slate-300">Extend timer by:</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={extraMinutes}
                      onChange={(e) => setExtraMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-center text-xs text-white focus:border-sky-500 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">minutes from now</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? (
              <span>Reinstating...</span>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Confirm & Reinstate</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
