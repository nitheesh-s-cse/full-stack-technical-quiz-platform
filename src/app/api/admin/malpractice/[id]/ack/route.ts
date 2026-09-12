import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { malpracticeEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  await db.update(malpracticeEvents).set({ adminAcknowledged: true }).where(eq(malpracticeEvents.id, Number(id)));
  return NextResponse.json({ ok: true });
}
