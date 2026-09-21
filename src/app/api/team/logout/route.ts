import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashToken } from "@/lib/crypto";
import { TEAM_COOKIE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TEAM_COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await db
      .update(teams)
      .set({ activeLoginTokenHash: null, updatedAt: new Date() })
      .where(eq(teams.activeLoginTokenHash, tokenHash));
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEAM_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
