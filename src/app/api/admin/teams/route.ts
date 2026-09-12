import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams, quizSessions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 25_000;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const allTeams = await db.select().from(teams).orderBy(desc(teams.createdAt));
  const allSessions = await db.select().from(quizSessions);

  const sessionsByTeam = new Map<number, typeof allSessions>();
  for (const s of allSessions) {
    const arr = sessionsByTeam.get(s.teamId) ?? [];
    arr.push(s);
    sessionsByTeam.set(s.teamId, arr);
  }

  const now = Date.now();
  const rows = allTeams.map((team) => {
    const sessions = sessionsByTeam.get(team.id) ?? [];
    const round1 = sessions.find((s) => s.round === 1) ?? null;
    const round2 = sessions.find((s) => s.round === 2) ?? null;
    const online = team.lastSeenAt ? now - new Date(team.lastSeenAt).getTime() < ONLINE_WINDOW_MS : false;

    return {
      id: team.id,
      teamCode: team.teamCode,
      teamName: team.teamName,
      members: [team.member1Name, team.member2Name, team.member3Name, team.member4Name].filter(Boolean),
      collegeDept: team.collegeDept,
      teamStatus: team.teamStatus,
      qualifiedForRound2: team.qualifiedForRound2,
      currentRound: team.currentRound,
      scoreRound1: team.scoreRound1,
      scoreRound2: team.scoreRound2,
      totalScore: team.totalScore,
      malpracticeCount: team.malpracticeCount,
      online,
      lastSeenAt: team.lastSeenAt,
      terminationReason: team.terminationReason,
      round1: round1 && { status: round1.status, endsAt: round1.endsAt, startedAt: round1.startedAt, score: round1.score },
      round2: round2 && { status: round2.status, endsAt: round2.endsAt, startedAt: round2.startedAt, score: round2.score },
    };
  });

  return NextResponse.json({ teams: rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (!rateLimit(`admin-create-team:${admin.id}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: {
    teamCode?: string;
    teamName?: string;
    member1?: string;
    member2?: string;
    member3?: string;
    member4?: string;
    collegeDept?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const teamCode = (body.teamCode ?? "").trim().toUpperCase();
  const teamName = (body.teamName ?? "").trim();
  if (!teamCode || !teamName) {
    return NextResponse.json({ error: "Team ID and team name are required." }, { status: 400 });
  }

  try {
    const [created] = await db
      .insert(teams)
      .values({
        teamCode,
        teamName,
        member1Name: body.member1?.trim() || null,
        member2Name: body.member2?.trim() || null,
        member3Name: body.member3?.trim() || null,
        member4Name: body.member4?.trim() || null,
        collegeDept: body.collegeDept?.trim() || null,
      })
      .returning();
    return NextResponse.json({ team: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create team.";
    if (message.includes("teams_team_code_idx")) {
      return NextResponse.json({ error: `Team ID ${teamCode} already exists.` }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
