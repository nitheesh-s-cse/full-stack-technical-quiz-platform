"use client";

import { useEffect, useState } from "react";
import { Trophy, FileSpreadsheet, Loader2 } from "lucide-react";

type Row = {
  rank: number;
  teamId: number;
  teamCode: string;
  teamName: string;
  score: number;
  scoreRound1?: number;
  scoreRound2?: number;
  scoreTieBreaker?: number;
  malpracticeCount: number;
  status: string;
  qualifiedForRound2?: boolean;
};

export default function LeaderboardPanel() {
  const [mode, setMode] = useState<"round1" | "round2" | "tiebreaker" | "final">("final");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/leaderboard?mode=${mode}`)
      .then((r) => r.json())
      .then((d) => setRows(d.leaderboard ?? []))
      .finally(() => setLoading(false));
  }, [mode]);

  async function handleExportLeaderboard() {
    setIsExporting(true);
    try {
      const sheetKey = mode === "final" ? "master" : mode === "round1" ? "round1" : mode === "round2" ? "round2" : "tiebreaker";
      const res = await fetch(`/api/admin/export?sheet=${sheetKey}`);
      if (!res.ok) throw new Error("Failed to export leaderboard");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Leaderboard_${mode.toUpperCase()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to export leaderboard Excel file.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-slate-100">
          <Trophy className="h-4 w-4 text-amber-400" /> Leaderboard
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs">
            {(["round1", "round2", "tiebreaker", "final"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 font-semibold ${mode === m ? "bg-emerald-500 text-slate-950" : "text-slate-400"}`}
              >
                {m === "round1" ? "Round 1" : m === "round2" ? "Round 2" : m === "tiebreaker" ? "Tie-Breaker" : "Final"}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportLeaderboard}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
            title="Download leaderboard as Excel (.xlsx)"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />}
            Export Excel
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-4">Rank</th>
                <th className="py-2 pr-4">Team</th>
                {mode === "final" && <th className="py-2 pr-4">R1</th>}
                {mode === "final" && <th className="py-2 pr-4">R2</th>}
                {mode === "final" && <th className="py-2 pr-4">TB</th>}
                <th className="py-2 pr-4">{mode === "tiebreaker" ? "TB Score" : "Score"}</th>
                <th className="py-2 pr-4">Malpractice</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.teamId} className="border-b border-slate-900">
                  <td className="py-2.5 pr-4 font-bold text-amber-400">#{r.rank}</td>
                  <td className="py-2.5 pr-4">
                    <p className="font-semibold text-slate-100">{r.teamName}</p>
                    <p className="font-mono-code text-[11px] text-slate-500">{r.teamCode}</p>
                  </td>
                  {mode === "final" && <td className="py-2.5 pr-4 font-mono-code">{Math.max(0, r.scoreRound1 ?? 0)}</td>}
                  {mode === "final" && <td className="py-2.5 pr-4 font-mono-code">{Math.max(0, r.scoreRound2 ?? 0)}</td>}
                  {mode === "final" && <td className="py-2.5 pr-4 font-mono-code text-amber-300">{Math.max(0, r.scoreTieBreaker ?? 0)}</td>}
                  <td className="py-2.5 pr-4 font-mono-code font-bold text-emerald-400">{Math.max(0, r.score)}</td>
                  <td className="py-2.5 pr-4">{r.malpracticeCount}/3</td>
                  <td className="py-2.5 pr-4 text-xs text-slate-400">{r.status}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={mode === "final" ? 8 : 6} className="py-8 text-center text-slate-600">
                    No completed submissions yet for this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
