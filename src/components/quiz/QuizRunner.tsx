"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Terminal, Wifi, WifiOff, ShieldAlert, AlertTriangle } from "lucide-react";
import CodeBlock from "@/components/CodeBlock";
import AnswerCard from "@/components/quiz/AnswerCard";
import QuestionNavigator from "@/components/quiz/QuestionNavigator";
import { useSecurityMonitor } from "@/hooks/useSecurityMonitor";
import { LANGUAGE_COLORS, LANGUAGE_DISPLAY } from "@/lib/language-map";
import type { ClientQuestion, OptionLabel } from "@/lib/quiz-engine";
import type { MalpracticeEventType } from "@/lib/constants";

type Props = {
  round: number;
  teamName: string;
  sessionId: number;
  questions: ClientQuestion[];
  initialAnswers: Record<number, string>;
  endsAt: string;
  serverNow: string;
  initialMalpracticeCount: number;
  onSubmitted: (result: { score: number; correctCount: number; totalQuestions: number }) => void;
  onTerminated: () => void;
};

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function QuizRunner({
  round,
  teamName,
  sessionId,
  questions,
  initialAnswers,
  endsAt,
  serverNow,
  initialMalpracticeCount,
  onSubmitted,
  onTerminated,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>(initialAnswers);
  const [offsetMs] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [endsAtMs, setEndsAtMs] = useState(() => new Date(endsAt).getTime());
  const [remainingMs, setRemainingMs] = useState(() => new Date(endsAt).getTime() - Date.now());
  const [malpracticeCount, setMalpracticeCount] = useState(initialMalpracticeCount);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [terminatedLocally, setTerminatedLocally] = useState(false);

  const submittedRef = useRef(false);
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  const currentQuestion = questions[currentIndex];

  const getCurrentQuestionId = useCallback(() => questionsRef.current[currentIndexRef.current]?.questionId ?? null, []);

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const res = await fetch("/api/quiz/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round }),
        });
        const data = await res.json();
        if (res.ok) {
          onSubmitted(data);
        } else {
          // Session likely already finalized server-side (e.g. time expired) — fetch state to reconcile.
          onSubmitted({ score: 0, correctCount: 0, totalQuestions: questions.length });
        }
      } catch {
        if (auto) {
          // Best effort — server will finalize automatically once it notices ends_at has passed.
        }
      } finally {
        setSubmitting(false);
      }
    },
    [round, onSubmitted, questions.length],
  );

  // Countdown tick
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = endsAtMs - (Date.now() + offsetMs);
      setRemainingMs(remaining);
      if (remaining <= 0 && !submittedRef.current) {
        handleSubmit(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAtMs, offsetMs, handleSubmit]);

  // Periodic resync with server (answers, timer, malpractice count, status)
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/quiz/state?round=${round}`, { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          setOnline(false);
          return;
        }
        setOnline(true);
        const data = await res.json();
        setEndsAtMs(new Date(data.endsAt).getTime());
        setMalpracticeCount(data.malpracticeCount ?? malpracticeCount);
        setAnswers((prev) => ({ ...prev, ...data.answers }));

        if (data.teamStatus === "TERMINATED") {
          setTerminatedLocally(true);
          onTerminated();
          return;
        }
        if (data.status !== "ACTIVE" && !submittedRef.current) {
          submittedRef.current = true;
          onSubmitted({ score: data.score ?? 0, correctCount: 0, totalQuestions: questions.length });
        }
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const handleServerSecurityResponse = useCallback(
    (eventType: MalpracticeEventType, res: { malpracticeCount: number; terminated: boolean }) => {
      setMalpracticeCount(res.malpracticeCount);
      if (res.terminated) {
        setTerminatedLocally(true);
        onTerminated();
        return;
      }
      const label = eventType.replaceAll("_", " ").toLowerCase();
      setToast(`Security notice: ${label} detected (${res.malpracticeCount}/3)`);
    },
    [onTerminated],
  );

  useSecurityMonitor({
    enabled: !terminatedLocally,
    round,
    getCurrentQuestionId,
    onServerResponse: handleServerSecurityResponse,
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function selectAnswer(label: OptionLabel) {
    if (!currentQuestion || submittedRef.current) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.questionId]: label }));
    try {
      const res = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round, questionId: currentQuestion.questionId, selectedLabel: label }),
      });
      setOnline(res.ok);
    } catch {
      setOnline(false);
    }
  }

  const answeredSet = useMemo(() => {
    const set = new Set<number>();
    questions.forEach((q, i) => {
      if (answers[q.questionId]) set.add(i);
    });
    return set;
  }, [questions, answers]);

  const answeredCount = answeredSet.size;
  const isCritical = remainingMs <= 60_000;
  const isWarning = remainingMs <= 5 * 60_000 && !isCritical;

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen pb-10">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-[#05070d]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-bold text-white">OUTPUT HUNT</p>
              <p className="text-[11px] text-slate-500">{teamName} · Round {round}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-xs text-slate-400 sm:block">
              Question <span className="font-semibold text-slate-200">{currentIndex + 1}</span> / {questions.length}
            </div>

            <div
              className={[
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                malpracticeCount === 0
                  ? "bg-slate-800 text-slate-400"
                  : malpracticeCount === 1
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-red-500/20 text-red-300",
              ].join(" ")}
              title="Malpractice strikes"
            >
              <ShieldAlert className="h-3.5 w-3.5" /> {malpracticeCount}/3
            </div>

            <div
              className={[
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono-code text-sm font-bold",
                isCritical
                  ? "pulse-danger border-red-500 bg-red-500/20 text-red-300"
                  : isWarning
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                    : "border-slate-700 bg-slate-900 text-slate-200",
              ].join(" ")}
            >
              {formatTime(remainingMs)}
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-500">
              {online ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-red-400" />}
              <span className="hidden sm:inline">{online ? "Online" : "Reconnecting"}</span>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed right-4 top-20 z-30 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 shadow-xl fade-in">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {toast}
        </div>
      )}

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="order-2 lg:order-1">
          <QuestionNavigator
            total={questions.length}
            currentIndex={currentIndex}
            answeredSet={answeredSet}
            onJump={setCurrentIndex}
          />
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-500">
            <p>Answered: <span className="font-semibold text-emerald-400">{answeredCount}</span> / {questions.length}</p>
          </div>
        </aside>

        <section className="order-1 space-y-5 lg:order-2">
          <div className="flex items-center gap-2">
            <span
              className={[
                "rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
                LANGUAGE_COLORS[currentQuestion.language] ?? "bg-slate-800 text-slate-300 border-slate-700",
              ].join(" ")}
            >
              {LANGUAGE_DISPLAY[currentQuestion.language] ?? currentQuestion.language}
            </span>
            <span className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
              {currentQuestion.difficulty}
            </span>
            <span className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
              {currentQuestion.marks} mark{currentQuestion.marks > 1 ? "s" : ""}
            </span>
          </div>

          <CodeBlock code={currentQuestion.code} language={currentQuestion.language} />

          <p className="no-select text-lg font-semibold text-slate-100">{currentQuestion.questionText}</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((label) => (
              <AnswerCard
                key={label}
                label={label}
                text={currentQuestion.options[label]}
                selected={answers[currentQuestion.questionId] === label}
                disabled={submitting}
                onSelect={() => selectAnswer(label)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 disabled:opacity-40"
            >
              ← Previous
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                Submit Quiz
              </button>
            )}
          </div>
        </section>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h3 className="text-lg font-bold text-white">Are you sure you want to submit?</h3>
            <p className="mt-2 text-sm text-slate-400">
              You have answered {answeredCount} of {questions.length} questions. Once submitted, you cannot change any
              answers.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-slate-500"
              >
                CANCEL
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "SUBMIT QUIZ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
