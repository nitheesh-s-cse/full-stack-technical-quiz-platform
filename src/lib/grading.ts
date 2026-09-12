import { db } from "@/db";
import { quizSessions, quizAnswers, questions, teams } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { QuestionOrder, OptionLabel } from "@/lib/quiz-engine";
import { resolveActualOption } from "@/lib/quiz-engine";
import { broadcast } from "@/lib/events";

type FinalizeResult = {
  score: number;
  correctCount: number;
  totalQuestions: number;
  alreadyFinalized: boolean;
};

/**
 * Server-authoritative grading. Safe to call multiple times (idempotent once
 * the session is no longer ACTIVE). Never trust any score computed on the
 * client — this is the single source of truth.
 */
export async function finalizeSession(
  sessionId: number,
  finalStatus: "COMPLETED" | "TERMINATED" | "EXPIRED",
): Promise<FinalizeResult> {
  const [session] = await db.select().from(quizSessions).where(eq(quizSessions.id, sessionId)).limit(1);
  if (!session) throw new Error("Session not found");

  if (session.status !== "ACTIVE") {
    return {
      score: session.score,
      correctCount: 0,
      totalQuestions: (session.questionOrder as QuestionOrder).length,
      alreadyFinalized: true,
    };
  }

  const order = session.questionOrder as QuestionOrder;
  const questionIds = order.map((o) => o.questionId);
  const questionRows = questionIds.length
    ? await db.select().from(questions).where(inArray(questions.id, questionIds))
    : [];
  const questionsById = new Map(questionRows.map((q) => [q.id, q]));

  const answers = await db.select().from(quizAnswers).where(eq(quizAnswers.sessionId, sessionId));
  const answersByQuestion = new Map(answers.map((a) => [a.questionId, a]));

  let score = 0;
  let correctCount = 0;

  for (const entry of order) {
    const question = questionsById.get(entry.questionId);
    if (!question) continue;
    const answer = answersByQuestion.get(entry.questionId);
    if (!answer || !answer.selectedLabel) continue;

    const actualOption = resolveActualOption(order, entry.questionId, answer.selectedLabel as OptionLabel);
    const isCorrect = actualOption === question.correctOption;
    const marksAwarded = isCorrect ? question.marks : question.negativeMarks > 0 ? -question.negativeMarks : 0;

    if (isCorrect) correctCount += 1;
    score += marksAwarded;

    await db
      .update(quizAnswers)
      .set({ isCorrect, marksAwarded, updatedAt: new Date() })
      .where(eq(quizAnswers.id, answer.id));
  }

  const now = new Date();
  await db
    .update(quizSessions)
    .set({ status: finalStatus, completedAt: now, score, updatedAt: now })
    .where(eq(quizSessions.id, sessionId));

  const [team] = await db.select().from(teams).where(eq(teams.id, session.teamId)).limit(1);
  if (team) {
    const patch: Partial<typeof teams.$inferInsert> = { updatedAt: now };
    if (session.round === 1) {
      patch.scoreRound1 = score;
      patch.quizCompletedAt = now;
    } else {
      patch.scoreRound2 = score;
      patch.round2CompletedAt = now;
    }
    const newTotal = (session.round === 1 ? score : team.scoreRound1) + (session.round === 2 ? score : team.scoreRound2);
    patch.totalScore = newTotal;

    if (finalStatus === "TERMINATED") {
      patch.teamStatus = "TERMINATED";
    } else if (team.teamStatus !== "TERMINATED" && team.teamStatus !== "DISQUALIFIED") {
      patch.teamStatus = "COMPLETED";
    }

    await db.update(teams).set(patch).where(eq(teams.id, team.id));

    broadcast({
      type: "QUIZ_SUBMITTED",
      teamId: team.id,
      teamCode: team.teamCode,
      teamName: team.teamName,
      round: session.round,
      data: { score, correctCount, totalQuestions: order.length, finalStatus },
    });
  }

  return { score, correctCount, totalQuestions: order.length, alreadyFinalized: false };
}

/** If a session's timer has expired but the client never called submit, grade it now. */
export async function ensureSessionFresh(sessionId: number) {
  const [session] = await db.select().from(quizSessions).where(eq(quizSessions.id, sessionId)).limit(1);
  if (!session) return null;
  if (session.status === "ACTIVE" && new Date(session.endsAt).getTime() <= Date.now()) {
    await finalizeSession(sessionId, "EXPIRED");
    const [refreshed] = await db.select().from(quizSessions).where(eq(quizSessions.id, sessionId)).limit(1);
    return refreshed ?? null;
  }
  return session;
}

export async function getActiveSessionForTeamRound(teamId: number, round: number) {
  const [session] = await db
    .select()
    .from(quizSessions)
    .where(and(eq(quizSessions.teamId, teamId), eq(quizSessions.round, round)))
    .limit(1);
  if (!session) return null;
  return ensureSessionFresh(session.id);
}
