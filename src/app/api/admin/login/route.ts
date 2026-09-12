import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { admins, adminSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { generateToken, hashToken } from "@/lib/crypto";
import { ADMIN_COOKIE } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`admin-login:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const [admin] = await db.select().from(admins).where(eq(admins.username, username)).limit(1);
  if (!admin) return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);
  await db.insert(adminSessions).values({ adminId: admin.id, tokenHash: hashToken(token), expiresAt });

  const res = NextResponse.json({ admin: { id: admin.id, username: admin.username, name: admin.name } });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
