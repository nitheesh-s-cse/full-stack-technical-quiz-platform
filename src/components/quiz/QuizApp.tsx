"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldX, Clock3, LogOut, CheckCircle2 } from "lucide-react";
import TeamLogin from "@/components/quiz/TeamLogin";
import RulesGate from "@/components/quiz/RulesGate";
import QuizRunner from "@/components/quiz/QuizRunner";
import type { ClientQuestion } from "@/lib/quiz-engine";

type PublicTeam = {
  id: number;
  teamCode: string;
  teamName: string;
  members: string[];
  teamStatus: string;
  qualifiedForRound2: boolean;
  currentRound: number;
  malpracticeCount: number;
};

type MeResponse = {
  team: PublicTeam | null;
  settings?: {
    round1Enabled: boolean;
    round2Enabled: boolean;
    tieBreakerEnabled?: boolean;
    tieBreakerDurationMinutes?: number;
  };
  round1?: { status: string; endsAt: string } | null;
  round2?: { status: string; endsAt: string } | null;
  round3?: { status: string; endsAt: string } | null;
};

type StartResponse = {
  sessionId: number;
  round: number;
  status: string;
  endsAt: string;
  serverNow: string;
  durationMinutes: number;
  questions: ClientQuestion[];
  error?: string;
};

type Phase = "loading" | "login" | "lobby" | "rules" | "quiz" | "result" | "terminated" | "waiting";

export default function QuizApp() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [team, setTeam] = useState<PublicTeam | null>(null);
  const [meInfo, setMeInfo] = useState<MeResponse | null>(null);
  const [targetRound, setTargetRound] = useState<1 | 2 | 3>(1);
  const [startData, setStartData] = useState<StartResponse | null>(null);
  const [initialAnswers, setInitialAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/team/me", { cache: "no-store" });
    const data: MeResponse = await res.json();
    setMeInfo(data);
    setTeam(data.team);
    return data;
  }, []);

  const decidePhase = useCallback((data: MeResponse) => {
    const t = data.team;
    if (!t) {
      setPhase("login");
      return;
    }
    if (t.teamStatus === "TERMINATED" || t.teamStatus === "DISQUALIFIED") {
      setPhase("terminated");
      return;
    }

    const r1 = data.round1;
    const r2 = data.round2;
    const r3 = data.round3;

    if (!r1 || r1.status === "ACTIVE") {
      setTargetRound(1);
      setPhase(data.settings?.round1Enabled || r1 ? "lobby" : "waiting");
      return;
    }

    // Round 1 finished in some terminal state.
    if (t.qualifiedForRound2) {
      if (!r2 || r2.status === "ACTIVE") {
        setTargetRound(2);
        setPhase(data.settings?.round2Enabled || r2 ? "lobby" : "waiting");
        return;
      }

      // Round 2 finished: check if Round 3 (Tie-Breaker) is active or enabled
      if (r3 && r3.status === "ACTIVE") {
        setTargetRound(3);
        setPhase("lobby");
        return;
      }

      if (data.settings?.tieBreakerEnabled) {
        if (!r3) {
          setTargetRound(3);
          setPhase("lobby");
          return;
        }
        setTargetRound(3);
        setPhase("result");
        return;
      }

      setTargetRound(2);
      setPhase("result");
      return;
    }

    setTargetRound(1);
    setPhase("result");
  }, []);

  const refresh = useCallback(async () => {
    const data = await loadMe();
    decidePhase(data);
  }, [loadMe, decidePhase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while waiting for the organizer to enable a round.
  useEffect(() => {
    if (phase !== "waiting") return;
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [phase, refresh]);

  async function handleStart() {
    setError(null);
    const res = await fetch("/api/quiz/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ round: targetRound }),
    });
    const data: StartResponse = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Unable to start the quiz.");
      await refresh();
      return;
    }

    // Fetch current saved answers for resume-after-refresh support.
    const stateRes = await fetch(`/api/quiz/state?round=${targetRound}`, { cache: "no-store" });
    const stateData = await stateRes.json().catch(() => ({}));

    setStartData(data);
    setInitialAnswers(stateData.answers ?? {});
    setPhase("quiz");
  }

  function handleSubmitted() {
    setSubmitted(true);
    setPhase("result");
    refresh();
  }

  function handleTerminated() {
    setPhase("terminated");
  }

  async function logout() {
    await fetch("/api/team/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (phase === "login") {
    return <TeamLogin onSuccess={refresh} />;
  }

  if (phase === "terminated") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center fade-in">
          <ShieldX className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h1 className="text-xl font-bold text-red-300">Team Disqualified</h1>
          <p className="mt-3 text-sm text-slate-400">
            Your team has been disqualified due to 3 confirmed malpractice violations, or by organizer action. This
            session cannot be restarted.
          </p>
          {team?.teamCode && <p className="mt-4 font-mono-code text-xs text-slate-600">{team.teamCode}</p>}
        </div>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center fade-in">
          <Clock3 className="mx-auto mb-4 h-10 w-10 text-amber-400" />
          <h1 className="text-xl font-bold text-white">Waiting for the organizer</h1>
          <p className="mt-3 text-sm text-slate-400">
            {targetRound === 1
              ? "Round 1 has not been enabled yet. This page will update automatically."
              : targetRound === 2
              ? "Your team is qualified for Round 2. Waiting for the organizer to enable it."
              : "Waiting for the organizer to enable the Java Tie-Breaker round."}
          </p>
          <p className="mt-4 text-xs text-slate-600">Team: {team?.teamName} ({team?.teamCode})</p>
        </div>
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center fade-in">
          <h1 className="text-2xl font-bold text-white">Welcome, {team?.teamName}</h1>
          <p className="mt-1 text-sm text-slate-500">{team?.teamCode} · {team?.members.join(", ")}</p>
          <p className="mt-6 text-sm text-slate-400">
            You are about to begin{" "}
            <span className="font-semibold text-emerald-400">
              {targetRound === 3 ? "Java Tie-Breaker Round (Round 3)" : `Round ${targetRound}`}
            </span>.
          </p>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          <button
            onClick={() => setPhase("rules")}
            className="mt-8 w-full rounded-lg bg-emerald-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-400"
          >
            Continue to Rules &amp; Security Notice
          </button>
          <button onClick={logout} className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs text-slate-600 hover:text-slate-400">
            <LogOut className="h-3.5 w-3.5" /> Not your team? Log out
          </button>
        </div>
      </div>
    );
  }

  if (phase === "rules") {
    return (
      <RulesGate
        round={targetRound}
        teamName={team?.teamName ?? ""}
        durationMinutes={
          targetRound === 1
            ? 30
            : targetRound === 2
            ? 20
            : (meInfo?.settings?.tieBreakerDurationMinutes ?? 10)
        }
        questionCount={targetRound === 1 ? 20 : targetRound === 2 ? 10 : 5}
        onStart={handleStart}
      />
    );
  }

  if (phase === "quiz" && startData) {
    return (
      <QuizRunner
        round={startData.round}
        teamName={team?.teamName ?? ""}
        sessionId={startData.sessionId}
        questions={startData.questions}
        initialAnswers={initialAnswers}
        endsAt={startData.endsAt}
        serverNow={startData.serverNow}
        initialMalpracticeCount={team?.malpracticeCount ?? 0}
        onSubmitted={handleSubmitted}
        onTerminated={handleTerminated}
      />
    );
  }

  if (phase === "result") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="max-w-lg w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center fade-in shadow-2xl shadow-emerald-950/20">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-8 ring-emerald-500/10">
            <CheckCircle2 className="h-9 w-9 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Answer Submitted Successfully</h1>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-4 py-1.5 text-sm font-semibold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Kindly wait for the instructions
          </div>
          <p className="mt-3 text-sm text-slate-300">
            Your responses for {targetRound === 3 ? "Java Tie-Breaker (Round 3)" : `Round ${targetRound}`} have been recorded by the server.
          </p>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 p-5 text-left text-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Team Name</span>
              <span className="font-semibold text-white">{team?.teamName}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Team Code</span>
              <span className="font-mono-code font-semibold text-emerald-400">{team?.teamCode}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Round</span>
              <span className="font-semibold text-slate-200">
                {targetRound === 3 ? "Java Tie-Breaker (Round 3)" : `Round ${targetRound}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Submission Status</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Submitted &amp; Recorded
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400 text-left flex gap-3 items-center">
            <span className="text-base select-none">ℹ️</span>
            <p>
              Kindly wait for the instructions.
            </p>
          </div>

          {meInfo?.settings?.tieBreakerEnabled && (!meInfo?.round3 || meInfo?.round3?.status === "ACTIVE") && (
            <button
              onClick={() => {
                setTargetRound(3);
                setPhase("lobby");
              }}
              className="mt-6 w-full rounded-lg bg-amber-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-400 shadow-lg shadow-amber-950/40"
            >
              Enter Java Tie-Breaker Round
            </button>
          )}

          <p className="mt-6 text-xs text-slate-500">
            {team?.qualifiedForRound2 && !meInfo?.round2
              ? "If qualified for Round 2, please wait for the organizer to announce results and enable the next round."
              : meInfo?.settings?.tieBreakerEnabled && !meInfo?.round3
              ? "Tie-Breaker mode is currently active! Click above to proceed if instructed."
              : "Thank you for participating! Kindly wait for the instructions."}
          </p>

          <button onClick={refresh} className="mt-6 text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
            Refresh status
          </button>
        </div>
      </div>
    );
  }

  return null;
}
