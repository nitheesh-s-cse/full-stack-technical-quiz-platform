import { db } from "@/db";
import { admins, adminSessions } from "@/db/schema";
import { eq, gt, and } from "drizzle-orm";
import { hashToken } from "@/lib/crypto";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/constants";

export type Admin = typeof admins.$inferSelect;

export async function getAdminByToken(token: string | undefined | null): Promise<Admin | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await db
    .select({ admin: admins })
    .from(adminSessions)
    .innerJoin(admins, eq(adminSessions.adminId, admins.id))
    .where(and(eq(adminSessions.tokenHash, tokenHash), gt(adminSessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.admin ?? null;
}

export async function requireAdmin(req: NextRequest): Promise<Admin | null> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return getAdminByToken(token);
}
