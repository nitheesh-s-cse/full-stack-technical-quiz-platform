import { NextRequest, NextResponse } from "next/server";
import { requireTeam } from "@/lib/team-auth";
import { recordMalpracticeEvent } from "@/lib/malpractice";
import { MALPRACTICE_EVENT_TYPES } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { getActiveSessionForTeamRound } from "@/lib/grading";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const team = await requireTeam(req);
  if (!team) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (!rateLimit(`security:${team.id}`, 30, 60_000)) {
    // Still respond OK so we don't reveal internals, just drop excess noise.
    return NextResponse.json({ malpracticeCount: team.malpracticeCount, terminated: false, throttled: true });
  }

  let body: { round?: number; eventType?: string; questionId?: number; metadata?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const round = Number(body.round) === 2 ? 2 : 1;
  const eventType = MALPRACTICE_EVENT_TYPES.includes(body.eventType as never)
    ? (body.eventType as (typeof MALPRACTICE_EVENT_TYPES)[number])
    : "OTHER";

  if (eventType === "RIGHT_CLICK") {
    return NextResponse.json({ malpracticeCount: team.malpracticeCount, terminated: false });
  }

  if (team.teamStatus === "TERMINATED" || team.teamStatus === "DISQUALIFIED") {
    return NextResponse.json({ malpracticeCount: team.malpracticeCount, terminated: true });
  }

  const session = await getActiveSessionForTeamRound(team.id, round);

  const result = await recordMalpracticeEvent({
    teamId: team.id,
    sessionId: session?.id ?? null,
    round,
    eventType,
    questionId: body.questionId ?? null,
    metadata: {
      ...body.metadata,
      userAgent: req.headers.get("user-agent"),
    },
  });

  return NextResponse.json(result);
}
