import { db } from "@/db";
import { adminActions } from "@/db/schema";

export async function logAdminAction(
  adminId: number,
  actionType: string,
  targetTeamId: number | null,
  details?: Record<string, unknown>,
) {
  await db.insert(adminActions).values({ adminId, actionType, targetTeamId, details: details ?? {} });
}
