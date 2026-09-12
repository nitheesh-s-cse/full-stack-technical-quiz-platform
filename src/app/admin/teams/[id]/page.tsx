"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { LANGUAGE_DISPLAY } from "@/lib/language-map";
import ReinstateModal from "@/components/admin/ReinstateModal";

type QuestionDetail = {
  position: number;
  questionId: number;
  language: string;
  difficulty: string;
  code: string;
  questionText: string;
  options: Record<string, string>;
  selectedLabel: string | null;
  correctLabel: string | null;
  isCorrect: boolean | null;
  marksAwarded: number;
  marks: number;
};

type RoundDetail = {
  round: number;
  status: string;
  startedAt: string;
  endsAt: string;
  completedAt: string | null;
  score: number;
  durationMinutes: number;
  questions: QuestionDetail[];
};

type MalpracticeEvent = {
  id: number;
  eventType: string;
  severity: string;
  round: number;
  questionId: number | null;
  occurredAt: string;
  adminAcknowledged: boolean;
  metadata: Record<string, unknown>;
};

type TeamDetail = {
  id: number;
  teamCode: string;
  teamName: string;
  member1Name: string | null;
  member2Name: string | null;
  member3Name: string | null;
  member4Name: string | null;
  collegeDept: string | null;
  teamStatus: string;
  qualifiedForRound2: boolean;
  currentRound: number;
  scoreRound1: number;
  scoreRound2: number;
  totalScore: number;
  malpracticeCount: number;
  terminationReason: string | null;
  quizStartedAt: string | null;
  quizCompletedAt: string | null;
  round2StartedAt: string | null;
  round2CompletedAt: string | null;
};

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [rounds, setRounds] = useState<RoundDetail[]>([]);
  const [events, setEvents] = useState<MalpracticeEvent[]>([]);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReinstate, setShowReinstate] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/teams/${id}`, { cache: "no-store" });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setTeam(data.team);
    setRounds(data.rounds ?? []);
    setEvents(data.malpracticeEvents ?? []);
    setExpandedRound((prev) => prev ?? data.rounds?.[0]?.round ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function ackEvent(eventId: number) {
    await fetch(`/api/admin/malpractice/${eventId}/ack`, { method: "POST" });
    load();
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading...</div>;
  if (!team) return <div className="flex min-h-screen items-center justify-center text-slate-500">Team not found.</div>;

  const members = [team.member1Name, team.member2Name, team.member3Name, team.member4Name].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/admin" className="mb-6 flex w-fit items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{team.teamName}</h1>
            <p className="font-mono-code text-sm text-slate-500">{team.teamCode} · {team.collegeDept ?? "—"}</p>
            <p className="mt-1 text-sm text-slate-400">Members: {members.join(", ") || "—"}</p>
          </div>
          <div className="text-right">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">{team.teamStatus}</span>
            {team.qualifiedForRound2 && (
              <p className="mt-1 text-xs font-semibold text-purple-400">★ Qualified for Round 2</p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Round 1 Score" value={team.scoreRound1} />
          <Stat label="Round 2 Score" value={team.scoreRound2} />
          <Stat label="Total Score" value={team.totalScore} accent="text-emerald-400" />
          <Stat label="Malpractice" value={team.malpracticeCount} accent={team.malpracticeCount > 0 ? "text-red-400" : undefined} suffix="/3" />
        </div>

        {(team.teamStatus === "TERMINATED" || team.teamStatus === "DISQUALIFIED") && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div>
              <p className="text-sm font-semibold text-red-200">
                This team is currently {team.teamStatus.toLowerCase()}.
              </p>
              {team.terminationReason && (
                <p className="mt-0.5 text-xs text-red-300/80">Reason: {team.terminationReason}</p>
              )}
            </div>
            <button
              onClick={() => setShowReinstate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500 transition-all"
            >
              <ShieldCheck className="h-4 w-4" /> Give Another Chance
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-100">
          <ShieldAlert className="h-4 w-4 text-red-400" /> Security / Malpractice Events ({events.length})
        </h2>
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-sm">
              <div>
                <p className="font-semibold text-slate-200">
                  {e.eventType.replaceAll("_", " ")}{" "}
                  <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">{e.severity}</span>
                  {e.eventType === "SCREEN_CAPTURE_SIGNAL" && (
                    <span className="ml-2 text-[10px] uppercase text-slate-500">Screenshot/Capture Signal — Browser Detectable</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  Round {e.round} · {e.questionId ? `Question #${e.questionId} · ` : ""}
                  {new Date(e.occurredAt).toLocaleString()}
                </p>
              </div>
              {e.adminAcknowledged ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledged
                </span>
              ) : (
                <button onClick={() => ackEvent(e.id)} className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500">
                  Acknowledge
                </button>
              )}
            </div>
          ))}
          {events.length === 0 && <p className="text-sm text-slate-600">No malpractice events recorded.</p>}
        </div>
      </div>

      {rounds.map((r) => (
        <div key={r.round} className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <button onClick={() => setExpandedRound(expandedRound === r.round ? null : r.round)} className="flex w-full items-center justify-between">
            <h2 className="font-semibold text-slate-100">
              Round {r.round} — {r.status} — Score {r.score}
            </h2>
            <span className="text-xs text-slate-500">
              {r.questions.filter((q) => q.selectedLabel).length}/{r.questions.length} answered
            </span>
          </button>

          {expandedRound === r.round && (
            <div className="mt-4 space-y-3">
              {r.questions.map((q) => (
                <div key={q.questionId} className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400">
                      Q{q.position} · {LANGUAGE_DISPLAY[q.language] ?? q.language} · {q.difficulty}
                    </p>
                    {q.selectedLabel ? (
                      q.isCorrect ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Correct (+{q.marksAwarded})
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
                          <XCircle className="h-3.5 w-3.5" /> Incorrect ({q.marksAwarded})
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-slate-500">Not answered</span>
                    )}
                  </div>
                  <pre className="mb-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-3 font-mono-code text-xs text-slate-300">{q.code}</pre>
                  <p className="mb-2 text-sm text-slate-300">{q.questionText}</p>
                  <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                    {Object.entries(q.options).map(([label, text]) => (
                      <div
                        key={label}
                        className={`rounded border px-2 py-1.5 font-mono-code ${
                          label === q.correctLabel
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                            : label === q.selectedLabel
                              ? "border-red-500/50 bg-red-500/10 text-red-300"
                              : "border-slate-800 text-slate-500"
                        }`}
                      >
                        {label}. {text}
                        {label === q.correctLabel && " ✓ correct"}
                        {label === q.selectedLabel && label !== q.correctLabel && " ← selected"}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {showReinstate && (
        <ReinstateModal
          target={{
            id: team.id,
            teamName: team.teamName,
            teamCode: team.teamCode,
            currentRound: team.currentRound,
          }}
          onClose={() => setShowReinstate(false)}
          onReinstated={load}
        />
      )}
    </div>
  );
}

function Stat({ label, value, accent, suffix }: { label: string; value: number; accent?: string; suffix?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${accent ?? "text-slate-100"}`}>
        {value}
        {suffix ?? ""}
      </p>
    </div>
  );
}
