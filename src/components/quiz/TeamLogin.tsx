"use client";

import { useState } from "react";
import { Terminal, ShieldAlert, ArrowRight, Loader2 } from "lucide-react";

export default function TeamLogin({ onSuccess }: { onSuccess: () => void }) {
  const [teamCode, setTeamCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/team/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to verify team.");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl fade-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
            <Terminal className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">OUTPUT HUNT</h1>
          <p className="mt-1 text-sm text-slate-500">VIYUGAM 2K26 · Team Access Portal</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Enter Team ID / Access Code
            </label>
            <input
              autoFocus
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
              placeholder="TEAM-001"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-center font-mono-code text-lg tracking-widest text-emerald-300 outline-none ring-emerald-500/40 placeholder:text-slate-700 focus:ring-2"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            VERIFY TEAM
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-600">
          Only one device may be active per team. Contact the organizer desk if you face access issues.
        </p>
      </div>
    </div>
  );
}
