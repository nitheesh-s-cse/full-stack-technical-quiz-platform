import { db } from "@/db";
import { malpracticeEvents, teams, quizSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { broadcast } from "@/lib/events";
import { finalizeSession } from "@/lib/grading";
import { EVENT_SEVERITY, MAX_MALPRACTICE_STRIKES, type MalpracticeEventType } from "@/lib/constants";

type RecordArgs = {
  teamId: number;
  sessionId?: number | null;
  round: number;
  eventType: MalpracticeEventType;
  questionId?: number | null;
  metadata?: Record<string, unknown>;
};

export async function recordMalpracticeEvent({ teamId, sessionId, round, eventType, questionId, metadata }: RecordArgs) {
  const severity = EVENT_SEVERITY[eventType] ?? "LOW";

  await db.insert(malpracticeEvents).values({
    teamId,
    sessionId: sessionId ?? null,
    round,
    eventType,
    questionId: questionId ?? null,
    metadata: metadata ?? {},
    severity,
  });

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) throw new Error("Team not found");

  const newCount = team.malpracticeCount + 1;
  const willTerminate = newCount >= MAX_MALPRACTICE_STRIKES;

  await db
    .update(teams)
    .set({
      malpracticeCount: newCount,
      updatedAt: new Date(),
      ...(willTerminate
        ? {
            teamStatus: "TERMINATED",
            terminationReason: `Automatically terminated after ${newCount} confirmed malpractice violations. Last: ${eventType}.`,
          }
        : {}),
    })
    .where(eq(teams.id, teamId));

  broadcast({
    type: "MALPRACTICE",
    teamId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    round,
    message: `${eventType} detected for ${team.teamName}`,
    data: { eventType, severity, malpracticeCount: newCount, questionId },
  });

  if (willTerminate) {
    const activeSessions = await db
      .select()
      .from(quizSessions)
      .where(and(eq(quizSessions.teamId, teamId), eq(quizSessions.status, "ACTIVE")));

    for (const s of activeSessions) {
      await finalizeSession(s.id, "TERMINATED");
    }

    broadcast({
      type: "TERMINATED",
      teamId,
      teamCode: team.teamCode,
      teamName: team.teamName,
      round,
      message: `${team.teamName} disqualified after 3 malpractice violations`,
      data: { malpracticeCount: newCount },
    });
  }

  return { malpracticeCount: newCount, terminated: willTerminate };
}
