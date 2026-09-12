import { NextRequest, NextResponse } from "next/server";
import { getTeamByToken } from "@/lib/team-auth";
import { publicTeam } from "@/lib/serialize";
import { getSettings } from "@/lib/settings";
import { db } from "@/db";
import { teams, quizSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TEAM_COOKIE } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Note: unlike requireTeam(), this endpoint intentionally does NOT hide
// terminated/disqualified teams — the participant UI needs to know that
// status to show the correct "disqualified" screen instead of a login form.
export async function GET(req: NextRequest) {
  const team = await getTeamByToken(req.cookies.get(TEAM_COOKIE)?.value);
  if (!team) return NextResponse.json({ team: null }, { status: 200 });

  await db.update(teams).set({ lastSeenAt: new Date() }).where(eq(teams.id, team.id));

  const settings = await getSettings();
  const sessions = await db.select().from(quizSessions).where(eq(quizSessions.teamId, team.id));
  const round1 = sessions.find((s) => s.round === 1);
  const round2 = sessions.find((s) => s.round === 2);

  return NextResponse.json({
    team: publicTeam(team),
    settings: {
      round1Enabled: settings?.round1Enabled ?? false,
      round2Enabled: settings?.round2Enabled ?? false,
    },
    round1: round1 ? { status: round1.status, endsAt: round1.endsAt } : null,
    round2: round2 ? { status: round2.status, endsAt: round2.endsAt } : null,
  });
}
