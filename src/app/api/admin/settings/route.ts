import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import { logAdminAction } from "@/lib/admin-actions";
import { broadcast } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  await getSettings();

  const patch: Partial<typeof eventSettings.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.round1Enabled === "boolean") patch.round1Enabled = body.round1Enabled;
  if (typeof body.round2Enabled === "boolean") patch.round2Enabled = body.round2Enabled;
  if (Number.isFinite(Number(body.round1DurationMinutes))) patch.round1DurationMinutes = Number(body.round1DurationMinutes);
  if (Number.isFinite(Number(body.round2DurationMinutes))) patch.round2DurationMinutes = Number(body.round2DurationMinutes);
  if (typeof body.tieBreakerEnabled === "boolean") patch.tieBreakerEnabled = body.tieBreakerEnabled;
  if (typeof body.tieBreakerNote === "string") patch.tieBreakerNote = body.tieBreakerNote;

  const [updated] = await db.update(eventSettings).set(patch).where(eq(eventSettings.id, 1)).returning();

  await logAdminAction(admin.id, "UPDATE_SETTINGS", null, patch);
  broadcast({ type: "SETTINGS_UPDATED", message: "Event settings updated", data: patch });

  return NextResponse.json({ settings: updated });
}
