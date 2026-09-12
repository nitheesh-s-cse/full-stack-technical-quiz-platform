import { NextRequest, NextResponse } from "next/server";
import { TEAM_COOKIE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEAM_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
