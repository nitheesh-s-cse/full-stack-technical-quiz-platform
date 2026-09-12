import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";
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
  const qualified = Boolean(body.qualified);

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  if (team.teamStatus === "TERMINATED" || team.teamStatus === "DISQUALIFIED") {
    return NextResponse.json({ error: "Cannot qualify a disqualified/terminated team." }, { status: 400 });
  }

  await db
    .update(teams)
    .set({
      qualifiedForRound2: qualified,
      teamStatus: qualified ? "QUALIFIED" : team.teamStatus === "QUALIFIED" ? "COMPLETED" : team.teamStatus,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));

  await logAdminAction(admin.id, qualified ? "QUALIFY_TEAM" : "UNQUALIFY_TEAM", teamId, {});

  broadcast({
    type: "TEAM_UPDATED",
    teamId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    message: `${team.teamName} ${qualified ? "qualified for Round 2" : "marked not qualified"}`,
  });

  return NextResponse.json({ ok: true });
}
