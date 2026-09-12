import { db } from "@/db";
import { eventSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getSettings() {
  const rows = await db.select().from(eventSettings).where(eq(eventSettings.id, 1)).limit(1);
  if (rows[0]) return rows[0];
  const [created] = await db
    .insert(eventSettings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const rows2 = await db.select().from(eventSettings).where(eq(eventSettings.id, 1)).limit(1);
  return rows2[0];
}
