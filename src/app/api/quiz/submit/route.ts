import { NextRequest, NextResponse } from "next/server";
import { requireTeam } from "@/lib/team-auth";
import { getActiveSessionForTeamRound, finalizeSession } from "@/lib/grading";

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
  if (round !== 1 && round !== 2) return NextResponse.json({ error: "Invalid round." }, { status: 400 });

  const session = await getActiveSessionForTeamRound(team.id, round);
  if (!session) return NextResponse.json({ error: "Quiz session not found." }, { status: 404 });

  const result = await finalizeSession(session.id, "COMPLETED");
  return NextResponse.json(result);
}
