import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams, quizSessions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-actions";
import { broadcast } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const teamId = Number(id);
  const body = await req.json().catch(() => ({}));
  const mode = (body.mode as string) === "resume" ? "resume" : "restart";
  const extraMinutes = typeof body.extraMinutes === "number" ? Math.max(1, body.extraMinutes) : undefined;

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  const currentRound = team.currentRound || 1;

  if (mode === "restart") {
    // Delete existing session and answers for the round (cascades to quiz_answers)
    await db
      .delete(quizSessions)
      .where(and(eq(quizSessions.teamId, teamId), eq(quizSessions.round, currentRound)));

    // Reset scores for this round
    const updatedScoreRound1 = currentRound === 1 ? 0 : team.scoreRound1;
    const updatedScoreRound2 = currentRound === 2 ? 0 : team.scoreRound2;
    const updatedTotalScore = updatedScoreRound1 + updatedScoreRound2;

    await db
      .update(teams)
      .set({
        teamStatus: "REGISTERED",
        malpracticeCount: 0,
        terminationReason: null,
        activeLoginTokenHash: null,
        deviceInfo: null,
        scoreRound1: updatedScoreRound1,
        scoreRound2: updatedScoreRound2,
        totalScore: updatedTotalScore,
        quizStartedAt: currentRound === 1 ? null : team.quizStartedAt,
        quizCompletedAt: currentRound === 1 ? null : team.quizCompletedAt,
        round2StartedAt: currentRound === 2 ? null : team.round2StartedAt,
        round2CompletedAt: currentRound === 2 ? null : team.round2CompletedAt,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId));
  } else {
    // Resume existing session
    const [existingSession] = await db
      .select()
      .from(quizSessions)
      .where(and(eq(quizSessions.teamId, teamId), eq(quizSessions.round, currentRound)))
      .limit(1);

    if (existingSession) {
      const minutesToAdd = extraMinutes ?? existingSession.durationMinutes ?? 15;
      const newEndsAt = new Date(Date.now() + minutesToAdd * 60_000);

      await db
        .update(quizSessions)
        .set({
          status: "ACTIVE",
          endsAt: newEndsAt,
          completedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(quizSessions.id, existingSession.id));
    }

    await db
      .update(teams)
      .set({
        teamStatus: "ACTIVE",
        malpracticeCount: 0,
        terminationReason: null,
        activeLoginTokenHash: null,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId));
  }

  await logAdminAction(admin.id, "REINSTATE_TEAM", teamId, { mode, round: currentRound });

  broadcast({
    type: "TEAM_UPDATED",
    teamId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    message: `${team.teamName} was reinstated by admin (${admin.username}) [${mode.toUpperCase()}]`,
    data: { mode, status: mode === "restart" ? "REGISTERED" : "ACTIVE" },
  });

  return NextResponse.json({
    ok: true,
    mode,
    status: mode === "restart" ? "REGISTERED" : "ACTIVE",
    message: `${team.teamName} has been reinstated successfully (${mode === "restart" ? "Restart fresh" : "Resumed"}).`,
  });
}
