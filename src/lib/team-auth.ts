import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashToken } from "@/lib/crypto";
import { BLOCKED_STATUSES } from "@/lib/constants";
import type { NextRequest } from "next/server";
import { TEAM_COOKIE } from "@/lib/constants";

export type Team = typeof teams.$inferSelect;

export async function getTeamByToken(token: string | undefined | null): Promise<Team | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await db.select().from(teams).where(eq(teams.activeLoginTokenHash, tokenHash)).limit(1);
  return rows[0] ?? null;
}

export async function requireTeam(req: NextRequest): Promise<Team | null> {
  const token = req.cookies.get(TEAM_COOKIE)?.value;
  const team = await getTeamByToken(token);
  if (!team) return null;
  if (BLOCKED_STATUSES.includes(team.teamStatus as (typeof BLOCKED_STATUSES)[number])) return null;
  return team;
}

export async function getTeamById(id: number): Promise<Team | null> {
  const rows = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  return rows[0] ?? null;
}
