import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams, quizSessions, quizAnswers, questions, malpracticeEvents } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-actions";
import { broadcast } from "@/lib/events";
import { displayedLabelForOption, buildClientQuestions, type QuestionOrder } from "@/lib/quiz-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const teamId = Number(id);
  if (!teamId) return NextResponse.json({ error: "Invalid team id." }, { status: 400 });

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  const sessions = await db.select().from(quizSessions).where(eq(quizSessions.teamId, teamId));

  const roundsDetail = [];
  for (const session of sessions) {
    const order = session.questionOrder as QuestionOrder;
    const questionIds = order.map((o) => o.questionId);
    const questionRows = questionIds.length
      ? await db.select().from(questions).where(inArray(questions.id, questionIds))
      : [];
    const questionsById = new Map(questionRows.map((q) => [q.id, q]));
    const clientQuestions = buildClientQuestions(order, questionsById);
    const answers = await db.select().from(quizAnswers).where(eq(quizAnswers.sessionId, session.id));
    const answersByQuestion = new Map(answers.map((a) => [a.questionId, a]));

    const questionDetails = clientQuestions.map((cq) => {
      const q = questionsById.get(cq.questionId)!;
      const answer = answersByQuestion.get(cq.questionId);
      const correctLabel = displayedLabelForOption(order, cq.questionId, q.correctOption as never);
      return {
        position: cq.position,
        questionId: cq.questionId,
        language: cq.language,
        difficulty: cq.difficulty,
        code: cq.code,
        questionText: cq.questionText,
        options: cq.options,
        selectedLabel: answer?.selectedLabel ?? null,
        correctLabel,
        isCorrect: answer?.isCorrect ?? null,
        marksAwarded: answer?.marksAwarded ?? 0,
        marks: q.marks,
        answeredAt: answer?.answeredAt ?? null,
      };
    });

    roundsDetail.push({
      round: session.round,
      status: session.status,
      startedAt: session.startedAt,
      endsAt: session.endsAt,
      completedAt: session.completedAt,
      score: session.score,
      durationMinutes: session.durationMinutes,
      questions: questionDetails,
    });
  }

  const events = await db
    .select()
    .from(malpracticeEvents)
    .where(eq(malpracticeEvents.teamId, teamId))
    .orderBy(desc(malpracticeEvents.occurredAt));

  return NextResponse.json({
    team,
    rounds: roundsDetail,
    malpracticeEvents: events,
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const teamId = Number(id);
  if (!teamId) return NextResponse.json({ error: "Invalid team id." }, { status: 400 });

  const [existing] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!existing) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  let body: {
    teamCode?: string;
    teamName?: string;
    member1Name?: string;
    member2Name?: string;
    member3Name?: string;
    member4Name?: string;
    collegeDept?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const teamCode = (body.teamCode ?? existing.teamCode).trim().toUpperCase();
  const teamName = (body.teamName ?? existing.teamName).trim();

  if (!teamCode || !teamName) {
    return NextResponse.json({ error: "Team ID and team name cannot be empty." }, { status: 400 });
  }

  // Check unique code collision
  if (teamCode !== existing.teamCode) {
    const [collision] = await db
      .select()
      .from(teams)
      .where(eq(teams.teamCode, teamCode))
      .limit(1);
    if (collision && collision.id !== teamId) {
      return NextResponse.json({ error: `Team ID "${teamCode}" is already in use by another team.` }, { status: 409 });
    }
  }

  const [updated] = await db
    .update(teams)
    .set({
      teamCode,
      teamName,
      member1Name: body.member1Name !== undefined ? body.member1Name?.trim() || null : existing.member1Name,
      member2Name: body.member2Name !== undefined ? body.member2Name?.trim() || null : existing.member2Name,
      member3Name: body.member3Name !== undefined ? body.member3Name?.trim() || null : existing.member3Name,
      member4Name: body.member4Name !== undefined ? body.member4Name?.trim() || null : existing.member4Name,
      collegeDept: body.collegeDept !== undefined ? body.collegeDept?.trim() || null : existing.collegeDept,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId))
    .returning();

  await logAdminAction(admin.id, "EDIT_TEAM", teamId, {
    oldCode: existing.teamCode,
    newCode: teamCode,
    oldName: existing.teamName,
    newName: teamName,
  });

  broadcast({
    type: "TEAM_UPDATED",
    teamId,
    teamCode: updated.teamCode,
    teamName: updated.teamName,
    message: `Team details updated by admin (${admin.username})`,
  });

  return NextResponse.json({ ok: true, team: updated });
}
