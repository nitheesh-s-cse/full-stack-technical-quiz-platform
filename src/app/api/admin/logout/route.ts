import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { adminSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashToken } from "@/lib/crypto";
import { ADMIN_COOKIE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (token) {
    await db.delete(adminSessions).where(eq(adminSessions.tokenHash, hashToken(token)));
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
