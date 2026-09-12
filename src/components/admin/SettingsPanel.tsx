"use client";

import { useState } from "react";
import { Save, Power, RotateCcw, AlertTriangle, X } from "lucide-react";

export type Settings = {
  round1Enabled: boolean;
  round1DurationMinutes: number;
  round2Enabled: boolean;
  round2DurationMinutes: number;
  tieBreakerEnabled: boolean;
  tieBreakerNote: string | null;
};

export default function SettingsPanel({
  settings,
  onSave,
  onReset,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<void>;
  onReset?: () => void;
}) {
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    const merged = { ...local, ...patch };
    setLocal(merged);
    await onSave(patch);
    setSaving(false);
    setSavedAt(Date.now());
  }

  async function handleResetGame() {
    if (resetConfirmInput.trim().toUpperCase() !== "RESET") {
      setResetError("Please type RESET to confirm.");
      return;
    }
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch("/api/admin/reset-game", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error ?? "Failed to reset game.");
        return;
      }
      setLocal((prev) => ({ ...prev, round1Enabled: false, round2Enabled: false, tieBreakerEnabled: false }));
      setResetSuccess(true);
      setShowResetModal(false);
      setResetConfirmInput("");
      onReset?.();
    } catch {
      setResetError("Network error while resetting competition.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <RoundCard
        title="Round 1 — Basic Output"
        enabled={local.round1Enabled}
        duration={local.round1DurationMinutes}
        onToggle={() => save({ round1Enabled: !local.round1Enabled })}
        onDuration={(v) => setLocal((p) => ({ ...p, round1DurationMinutes: v }))}
        onSaveDuration={() => save({ round1DurationMinutes: local.round1DurationMinutes })}
      />
      <RoundCard
        title="Round 2 — Advanced Output"
        enabled={local.round2Enabled}
        duration={local.round2DurationMinutes}
        onToggle={() => save({ round2Enabled: !local.round2Enabled })}
        onDuration={(v) => setLocal((p) => ({ ...p, round2DurationMinutes: v }))}
        onSaveDuration={() => save({ round2DurationMinutes: local.round2DurationMinutes })}
      />

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 lg:col-span-2">
        <h3 className="mb-1 font-semibold text-slate-100">Tie-Breaker Mode</h3>
        <p className="mb-4 text-xs text-slate-500">
          Enable when the final leaderboard has tied scores. Announce the tie-breaker question verbally or on
          screen, and use this note field to record it for the audit trail.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={() => save({ tieBreakerEnabled: !local.tieBreakerEnabled })}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${
              local.tieBreakerEnabled
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border-slate-700 text-slate-400"
            }`}
          >
            <Power className="h-4 w-4" /> {local.tieBreakerEnabled ? "Tie-Breaker ON" : "Tie-Breaker OFF"}
          </button>
          <input
            value={local.tieBreakerNote ?? ""}
            onChange={(e) => setLocal((p) => ({ ...p, tieBreakerNote: e.target.value }))}
            placeholder="Tie-breaker question / notes..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-amber-500/40"
          />
          <button
            onClick={() => save({ tieBreakerNote: local.tieBreakerNote })}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </div>

      {/* Danger Zone: Full Game Reset */}
      <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-5 lg:col-span-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-red-300">
              <RotateCcw className="h-4 w-4 text-red-400" /> Fully Restart Competition / Reset Game
            </h3>
            <p className="mt-1 text-xs text-red-400/80">
              Permanently clears all student answers, active sessions, scores, and malpractice strikes. All teams return to Round 1 start with 0 points.
            </p>
          </div>
          <button
            onClick={() => {
              setShowResetModal(true);
              setResetConfirmInput("");
              setResetError(null);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/60 bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-950/40 hover:bg-red-500 transition-all shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Entire Competition
          </button>
        </div>
      </div>

      {resetSuccess && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300 lg:col-span-2">
          ✓ Entire competition has been reset successfully. All sessions, answers, and scores cleared.
        </p>
      )}

      {savedAt && <p className="text-xs text-emerald-400 lg:col-span-2">Settings saved.</p>}
      {saving && <p className="text-xs text-slate-500 lg:col-span-2">Saving...</p>}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-base font-bold text-white">Reset Entire Competition</h3>
              </div>
              <button onClick={() => setShowResetModal(false)} className="rounded-lg p-1 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-red-200">
                <strong>WARNING:</strong> This action cannot be undone. All submitted answers, active quiz sessions, scores, and malpractice events will be permanently deleted.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400">
                <li>All registered teams will be preserved.</li>
                <li>All teams will be reset to Round 1 start with 0 points and 0 strikes.</li>
                <li>Round 1 and Round 2 will be disabled until you re-enable them.</li>
              </ul>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mt-2">
                  Type <span className="font-mono text-red-400 font-bold">RESET</span> to confirm:
                </label>
                <input
                  type="text"
                  value={resetConfirmInput}
                  onChange={(e) => setResetConfirmInput(e.target.value)}
                  placeholder="RESET"
                  className="mt-1 w-full rounded-lg border border-red-500/40 bg-slate-950 px-3 py-2 font-mono text-xs text-white uppercase focus:border-red-500 focus:outline-none"
                />
              </div>
              {resetError && <p className="text-red-400 font-medium">{resetError}</p>}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetGame}
                disabled={resetting || resetConfirmInput.trim().toUpperCase() !== "RESET"}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-950/40 hover:bg-red-500 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {resetting ? "Resetting..." : "Yes, Reset Everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoundCard({
  title,
  enabled,
  duration,
  onToggle,
  onDuration,
  onSaveDuration,
}: {
  title: string;
  enabled: boolean;
  duration: number;
  onToggle: () => void;
  onDuration: (v: number) => void;
  onSaveDuration: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">{title}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-400"}`}>
          {enabled ? "ENABLED" : "DISABLED"}
        </span>
      </div>
      <button
        onClick={onToggle}
        className={`mb-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
          enabled ? "bg-red-500/20 text-red-300 hover:bg-red-500/30" : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
        }`}
      >
        <Power className="h-4 w-4" /> {enabled ? "Disable Round" : "Enable Round"}
      </button>

      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Duration (minutes)</label>
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={duration}
          onChange={(e) => onDuration(Number(e.target.value))}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
        <button onClick={onSaveDuration} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
          Save
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-600">Applies to new sessions started after saving. Already-active teams keep their original timer.</p>
    </div>
  );
}
