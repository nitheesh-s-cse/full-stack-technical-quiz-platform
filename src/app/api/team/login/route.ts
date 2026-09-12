import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateToken, hashToken } from "@/lib/crypto";
import { TEAM_COOKIE, BLOCKED_STATUSES } from "@/lib/constants";
import { broadcast } from "@/lib/events";
import { publicTeam } from "@/lib/serialize";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`login:${ip}`, 15, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 });
  }

  let body: { teamCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const teamCode = (body.teamCode ?? "").trim().toUpperCase();
  if (!teamCode) {
    return NextResponse.json({ error: "Please enter a Team ID." }, { status: 400 });
  }

  const [team] = await db.select().from(teams).where(eq(teams.teamCode, teamCode)).limit(1);

  if (!team) {
    return NextResponse.json({ error: "Team not registered." }, { status: 404 });
  }

  if (BLOCKED_STATUSES.includes(team.teamStatus as (typeof BLOCKED_STATUSES)[number])) {
    return NextResponse.json(
      { error: `This team has been ${team.teamStatus.toLowerCase()} and cannot access the event.` },
      { status: 403 },
    );
  }

  const existingCookieToken = req.cookies.get(TEAM_COOKIE)?.value;
  const existingHashMatches =
    existingCookieToken && team.activeLoginTokenHash && hashToken(existingCookieToken) === team.activeLoginTokenHash;

  let tokenToSet = existingCookieToken;

  if (team.activeLoginTokenHash && !existingHashMatches) {
    return NextResponse.json(
      { error: "This team already has an active session on another device. Ask the admin to reset the session if this is a mistake." },
      { status: 409 },
    );
  }

  if (!team.activeLoginTokenHash) {
    tokenToSet = generateToken();
    const deviceInfo = req.headers.get("user-agent") ?? "unknown-device";
    await db
      .update(teams)
      .set({
        activeLoginTokenHash: hashToken(tokenToSet),
        deviceInfo,
        lastSeenAt: new Date(),
        teamStatus: team.teamStatus === "REGISTERED" ? "WAITING" : team.teamStatus,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team.id));

    broadcast({
      type: "TEAM_LOGIN",
      teamId: team.id,
      teamCode: team.teamCode,
      teamName: team.teamName,
      message: `${team.teamName} logged in`,
    });
  } else {
    await db.update(teams).set({ lastSeenAt: new Date() }).where(eq(teams.id, team.id));
  }

  const [refreshed] = await db.select().from(teams).where(eq(teams.id, team.id)).limit(1);

  const res = NextResponse.json({ team: publicTeam(refreshed) });
  res.cookies.set(TEAM_COOKIE, tokenToSet!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
