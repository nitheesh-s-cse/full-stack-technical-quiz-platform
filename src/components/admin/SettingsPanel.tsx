"use client";

import { useState } from "react";
import { Save, Power } from "lucide-react";

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
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<void>;
}) {
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    const merged = { ...local, ...patch };
    setLocal(merged);
    await onSave(patch);
    setSaving(false);
    setSavedAt(Date.now());
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

      {savedAt && <p className="text-xs text-emerald-400 lg:col-span-2">Settings saved.</p>}
      {saving && <p className="text-xs text-slate-500 lg:col-span-2">Saving...</p>}
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
