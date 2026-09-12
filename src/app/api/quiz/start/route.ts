import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions, quizSessions, teams } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireTeam } from "@/lib/team-auth";
import { getSettings } from "@/lib/settings";
import { getActiveSessionForTeamRound } from "@/lib/grading";
import { buildClientQuestions, buildQuestionOrder, type QuestionOrder } from "@/lib/quiz-engine";
import { broadcast } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const team = await requireTeam(req);
  if (!team) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: { round?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const round = Number(body.round);
  if (round !== 1 && round !== 2) {
    return NextResponse.json({ error: "Invalid round." }, { status: 400 });
  }

  const settings = await getSettings();
  if (round === 1 && !settings?.round1Enabled) {
    return NextResponse.json({ error: "Round 1 has not been enabled by the organizers yet." }, { status: 403 });
  }
  if (round === 2) {
    if (!team.qualifiedForRound2) {
      return NextResponse.json({ error: "Round 2 access denied. Your team has not qualified." }, { status: 403 });
    }
    if (!settings?.round2Enabled) {
      return NextResponse.json({ error: "Round 2 access denied. Round 2 is not currently enabled." }, { status: 403 });
    }
  }

  let session = await getActiveSessionForTeamRound(team.id, round);

  if (session && session.status !== "ACTIVE") {
    return NextResponse.json(
      {
        error: `This round has already been ${session.status.toLowerCase()} for your team.`,
        status: session.status,
      },
      { status: 409 },
    );
  }

  const questionRows = await db
    .select()
    .from(questions)
    .where(and(eq(questions.round, round), eq(questions.isActive, true)))
    .orderBy(questions.orderIndex);

  if (!session) {
    if (questionRows.length === 0) {
      return NextResponse.json({ error: "No questions configured for this round yet." }, { status: 500 });
    }
    const order = buildQuestionOrder(questionRows.map((q) => q.id));
    const durationMinutes = round === 1 ? settings!.round1DurationMinutes : settings!.round2DurationMinutes;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + durationMinutes * 60_000);

    const [created] = await db
      .insert(quizSessions)
      .values({
        teamId: team.id,
        round,
        status: "ACTIVE",
        questionOrder: order,
        durationMinutes,
        startedAt,
        endsAt,
      })
      .returning();
    session = created;

    await db
      .update(teams)
      .set({
        currentRound: round,
        teamStatus: "ACTIVE",
        quizStartedAt: round === 1 ? startedAt : team.quizStartedAt,
        round2StartedAt: round === 2 ? startedAt : team.round2StartedAt,
        updatedAt: startedAt,
      })
      .where(eq(teams.id, team.id));

    broadcast({
      type: "QUIZ_STARTED",
      teamId: team.id,
      teamCode: team.teamCode,
      teamName: team.teamName,
      round,
      message: `${team.teamName} started Round ${round}`,
    });
  }

  const questionsById = new Map(questionRows.map((q) => [q.id, q]));
  const clientQuestions = buildClientQuestions(session.questionOrder as QuestionOrder, questionsById);

  return NextResponse.json({
    sessionId: session.id,
    round,
    status: session.status,
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    serverNow: new Date().toISOString(),
    durationMinutes: session.durationMinutes,
    questions: clientQuestions,
  });
}
