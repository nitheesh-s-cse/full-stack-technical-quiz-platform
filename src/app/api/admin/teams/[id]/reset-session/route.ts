import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-actions";
import { broadcast } from "@/lib/events";

export const dynamic = "force-dynamic";

// Clears the device/login lock for a team, e.g. if their laptop crashed and
// they need to re-verify from a new device. Does NOT touch quiz progress,
// answers, score, or malpractice count.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const teamId = Number(id);
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  await db
    .update(teams)
    .set({ activeLoginTokenHash: null, deviceInfo: null, updatedAt: new Date() })
    .where(eq(teams.id, teamId));

  await logAdminAction(admin.id, "RESET_SESSION", teamId, {});

  broadcast({
    type: "TEAM_UPDATED",
    teamId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    message: `${team.teamName}'s device session was reset by admin`,
  });

  return NextResponse.json({ ok: true });
}
