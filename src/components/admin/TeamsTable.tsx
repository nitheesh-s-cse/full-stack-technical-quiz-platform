"use client";

import Link from "next/link";
import { Circle, ShieldOff, RotateCcw, Award, Eye } from "lucide-react";

export type AdminTeamRow = {
  id: number;
  teamCode: string;
  teamName: string;
  members: string[];
  collegeDept: string | null;
  teamStatus: string;
  qualifiedForRound2: boolean;
  currentRound: number;
  scoreRound1: number;
  scoreRound2: number;
  totalScore: number;
  malpracticeCount: number;
  online: boolean;
  lastSeenAt: string | null;
  terminationReason: string | null;
  round1: { status: string; endsAt: string; startedAt: string; score: number } | null;
  round2: { status: string; endsAt: string; startedAt: string; score: number } | null;
};

const STATUS_COLORS: Record<string, string> = {
  REGISTERED: "bg-slate-700 text-slate-300",
  WAITING: "bg-slate-600 text-slate-200",
  ACTIVE: "bg-emerald-500/20 text-emerald-300",
  COMPLETED: "bg-sky-500/20 text-sky-300",
  QUALIFIED: "bg-purple-500/20 text-purple-300",
  DISQUALIFIED: "bg-red-500/20 text-red-300",
  TERMINATED: "bg-red-600/30 text-red-300",
};

function timeLeft(endsAt: string) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "00:00";
  const m = Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0");
  const s = Math.floor((ms % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function TeamsTable({
  teams,
  onTerminate,
  onQualify,
  onResetSession,
}: {
  teams: AdminTeamRow[];
  onTerminate: (id: number) => void;
  onQualify: (id: number, qualified: boolean) => void;
  onResetSession: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full min-w-[1000px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/70 text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3">Members</th>
            <th className="px-4 py-3">Round</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Malpractice</th>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Connection</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => {
            const activeRound = t.currentRound === 2 ? t.round2 : t.round1;
            return (
              <tr key={t.id} className="border-b border-slate-900 hover:bg-slate-900/40">
                <td className="px-4 py-3">
                  <Link href={`/admin/teams/${t.id}`} className="font-semibold text-slate-100 hover:text-emerald-400">
                    {t.teamName}
                  </Link>
                  <p className="font-mono-code text-[11px] text-slate-500">{t.teamCode}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{t.members.length} members</td>
                <td className="px-4 py-3 text-xs text-slate-300">
                  Round {t.currentRound}
                  {t.qualifiedForRound2 && <span className="ml-1 text-purple-400">★</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_COLORS[t.teamStatus] ?? "bg-slate-700 text-slate-300"}`}>
                    {t.teamStatus}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono-code text-slate-200">
                  {t.scoreRound1}
                  {t.round2 ? ` + ${t.scoreRound2}` : ""} = {t.totalScore}
                </td>
                <td className="px-4 py-3">
                  <span className={t.malpracticeCount >= 3 ? "font-bold text-red-400" : t.malpracticeCount > 0 ? "text-amber-400" : "text-slate-500"}>
                    {t.malpracticeCount}/3
                  </span>
                </td>
                <td className="px-4 py-3 font-mono-code text-xs text-slate-400">
                  {activeRound?.status === "ACTIVE" ? timeLeft(activeRound.endsAt) : activeRound ? activeRound.status : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-xs">
                    <Circle className={`h-2.5 w-2.5 ${t.online ? "fill-emerald-400 text-emerald-400" : "fill-slate-600 text-slate-600"}`} />
                    {t.online ? "ONLINE" : "OFFLINE"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/teams/${t.id}`} title="View details" className="rounded-md border border-slate-700 p-1.5 hover:border-slate-500">
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      title="Toggle Round 2 qualification"
                      onClick={() => onQualify(t.id, !t.qualifiedForRound2)}
                      disabled={t.teamStatus === "TERMINATED" || t.teamStatus === "DISQUALIFIED"}
                      className={`rounded-md border p-1.5 disabled:opacity-30 ${t.qualifiedForRound2 ? "border-purple-500/50 text-purple-300" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}
                    >
                      <Award className="h-3.5 w-3.5" />
                    </button>
                    <button
                      title="Reset device session"
                      onClick={() => onResetSession(t.id)}
                      className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-slate-500"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      title="Terminate team"
                      onClick={() => onTerminate(t.id)}
                      disabled={t.teamStatus === "TERMINATED"}
                      className="rounded-md border border-red-500/40 p-1.5 text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {teams.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-slate-600">
                No teams registered yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
