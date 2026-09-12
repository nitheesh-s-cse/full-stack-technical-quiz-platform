import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  await db.update(questions).set({ isActive: false }).where(eq(questions.id, Number(id)));
  await logAdminAction(admin.id, "DEACTIVATE_QUESTION", null, { questionId: Number(id) });
  return NextResponse.json({ ok: true });
}
