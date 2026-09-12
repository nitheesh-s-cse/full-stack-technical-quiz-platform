import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ admin: null }, { status: 200 });
  return NextResponse.json({ admin: { id: admin.id, username: admin.username, name: admin.name } });
}
