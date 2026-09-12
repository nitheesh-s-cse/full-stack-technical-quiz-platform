import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quizAnswers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireTeam } from "@/lib/team-auth";
import { getActiveSessionForTeamRound } from "@/lib/grading";
import { OPTION_LABELS, type QuestionOrder } from "@/lib/quiz-engine";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const team = await requireTeam(req);
  if (!team) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (!rateLimit(`answer:${team.id}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: { round?: number; questionId?: number; selectedLabel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const round = Number(body.round);
  const questionId = Number(body.questionId);
  const selectedLabel = String(body.selectedLabel ?? "").toUpperCase();

  if ((round !== 1 && round !== 2) || !questionId || !OPTION_LABELS.includes(selectedLabel as never)) {
    return NextResponse.json({ error: "Invalid answer payload." }, { status: 400 });
  }

  const session = await getActiveSessionForTeamRound(team.id, round);
  if (!session) return NextResponse.json({ error: "Quiz session not found." }, { status: 404 });
  if (session.status !== "ACTIVE") {
    return NextResponse.json({ error: "This round is no longer active. Your answer was not saved." }, { status: 409 });
  }

  const order = session.questionOrder as QuestionOrder;
  const belongs = order.some((o) => o.questionId === questionId);
  if (!belongs) return NextResponse.json({ error: "Question does not belong to this session." }, { status: 400 });

  const [existing] = await db
    .select()
    .from(quizAnswers)
    .where(and(eq(quizAnswers.sessionId, session.id), eq(quizAnswers.questionId, questionId)))
    .limit(1);

  if (existing) {
    await db
      .update(quizAnswers)
      .set({ selectedLabel, updatedAt: new Date() })
      .where(eq(quizAnswers.id, existing.id));
  } else {
    await db.insert(quizAnswers).values({
      sessionId: session.id,
      teamId: team.id,
      questionId,
      round,
      selectedLabel,
    });
  }

  return NextResponse.json({ ok: true });
}
