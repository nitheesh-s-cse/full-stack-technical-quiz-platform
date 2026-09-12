import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams, quizSessions, quizAnswers, malpracticeEvents, eventSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-actions";
import { broadcast } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    // 1. Delete all answers and quiz sessions
    await db.delete(quizAnswers);
    await db.delete(quizSessions);

    // 2. Delete all recorded malpractice events
    await db.delete(malpracticeEvents);

    // 3. Reset all teams back to fresh REGISTERED state
    await db.update(teams).set({
      teamStatus: "REGISTERED",
      qualifiedForRound2: false,
      currentRound: 1,
      quizStartedAt: null,
      quizCompletedAt: null,
      round2StartedAt: null,
      round2CompletedAt: null,
      scoreRound1: 0,
      scoreRound2: 0,
      totalScore: 0,
      malpracticeCount: 0,
      activeLoginTokenHash: null,
      deviceInfo: null,
      lastSeenAt: null,
      terminationReason: null,
      updatedAt: new Date(),
    });

    // 4. Disable all rounds and tie-breaker in event settings
    await db.update(eventSettings).set({
      round1Enabled: false,
      round2Enabled: false,
      tieBreakerEnabled: false,
      updatedAt: new Date(),
    });

    // 5. Audit log
    await logAdminAction(admin.id, "RESET_FULL_GAME", null, {
      adminUsername: admin.username,
      at: new Date().toISOString(),
    });

    // 6. Broadcast live events
    broadcast({
      type: "SETTINGS_UPDATED",
      message: "Competition was fully reset by admin",
    });
    broadcast({
      type: "TEAM_UPDATED",
      message: "All teams have been reset to Round 1",
    });

    return NextResponse.json({
      ok: true,
      message: "Competition reset successfully. All scores and sessions have been cleared.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reset competition.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
