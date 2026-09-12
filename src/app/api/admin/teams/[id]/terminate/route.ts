import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams, quizSessions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { finalizeSession } from "@/lib/grading";
import { logAdminAction } from "@/lib/admin-actions";
import { broadcast } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const teamId = Number(id);
  const body = await req.json().catch(() => ({}));
  const reason = (body.reason as string) || "Terminated by admin.";

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  await db
    .update(teams)
    .set({ teamStatus: "TERMINATED", terminationReason: reason, updatedAt: new Date() })
    .where(eq(teams.id, teamId));

  const activeSessions = await db
    .select()
    .from(quizSessions)
    .where(and(eq(quizSessions.teamId, teamId), eq(quizSessions.status, "ACTIVE")));
  for (const s of activeSessions) {
    await finalizeSession(s.id, "TERMINATED");
  }

  await logAdminAction(admin.id, "TERMINATE_TEAM", teamId, { reason });

  broadcast({
    type: "TERMINATED",
    teamId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    message: `${team.teamName} terminated by admin (${admin.username})`,
    data: { reason },
  });

  return NextResponse.json({ ok: true });
}
