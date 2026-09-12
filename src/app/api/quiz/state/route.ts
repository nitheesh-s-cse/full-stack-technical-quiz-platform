import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions, quizAnswers } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireTeam } from "@/lib/team-auth";
import { getActiveSessionForTeamRound } from "@/lib/grading";
import { buildClientQuestions, type QuestionOrder } from "@/lib/quiz-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const team = await requireTeam(req);
  if (!team) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const round = Number(req.nextUrl.searchParams.get("round"));
  if (round !== 1 && round !== 2) return NextResponse.json({ error: "Invalid round." }, { status: 400 });

  const session = await getActiveSessionForTeamRound(team.id, round);
  if (!session) return NextResponse.json({ error: "Quiz not started for this round." }, { status: 404 });

  const order = session.questionOrder as QuestionOrder;
  const questionIds = order.map((o) => o.questionId);
  const questionRows = questionIds.length
    ? await db.select().from(questions).where(inArray(questions.id, questionIds))
    : [];
  const questionsById = new Map(questionRows.map((q) => [q.id, q]));
  const clientQuestions = buildClientQuestions(order, questionsById);

  const answers = await db.select().from(quizAnswers).where(eq(quizAnswers.sessionId, session.id));
  const answersMap: Record<number, string> = {};
  for (const a of answers) {
    if (a.selectedLabel) answersMap[a.questionId] = a.selectedLabel;
  }

  return NextResponse.json({
    sessionId: session.id,
    round,
    status: session.status,
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    serverNow: new Date().toISOString(),
    durationMinutes: session.durationMinutes,
    questions: clientQuestions,
    answers: answersMap,
    score: session.status !== "ACTIVE" ? session.score : undefined,
    malpracticeCount: team.malpracticeCount,
    teamStatus: team.teamStatus,
  });
}
