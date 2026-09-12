"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

type Row = {
  rank: number;
  teamId: number;
  teamCode: string;
  teamName: string;
  score: number;
  scoreRound1?: number;
  scoreRound2?: number;
  malpracticeCount: number;
  status: string;
  qualifiedForRound2?: boolean;
};

export default function LeaderboardPanel() {
  const [mode, setMode] = useState<"round1" | "round2" | "final">("final");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/leaderboard?mode=${mode}`)
      .then((r) => r.json())
      .then((d) => setRows(d.leaderboard ?? []))
      .finally(() => setLoading(false));
  }, [mode]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-slate-100">
          <Trophy className="h-4 w-4 text-amber-400" /> Leaderboard
        </h3>
        <div className="flex gap-1.5 rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs">
          {(["round1", "round2", "final"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 font-semibold ${mode === m ? "bg-emerald-500 text-slate-950" : "text-slate-400"}`}
            >
              {m === "round1" ? "Round 1" : m === "round2" ? "Round 2" : "Final"}
            </button>
          ))}
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
                <th className="py-2 pr-4">Score</th>
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
                  {mode === "final" && <td className="py-2.5 pr-4 font-mono-code">{r.scoreRound1}</td>}
                  {mode === "final" && <td className="py-2.5 pr-4 font-mono-code">{r.scoreRound2}</td>}
                  <td className="py-2.5 pr-4 font-mono-code font-bold text-emerald-400">{r.score}</td>
                  <td className="py-2.5 pr-4">{r.malpracticeCount}/3</td>
                  <td className="py-2.5 pr-4 text-xs text-slate-400">{r.status}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-600">
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
