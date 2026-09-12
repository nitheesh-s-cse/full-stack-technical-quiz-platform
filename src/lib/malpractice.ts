import { db } from "@/db";
import { malpracticeEvents, teams, quizSessions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

const INCIDENT_COOLDOWN_MS = 3000;
const EXIT_EVENTS: readonly MalpracticeEventType[] = ["TAB_SWITCH", "WINDOW_BLUR", "FULLSCREEN_EXIT"];

export async function recordMalpracticeEvent({ teamId, sessionId, round, eventType, questionId, metadata }: RecordArgs) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) throw new Error("Team not found");

  if (team.teamStatus === "TERMINATED" || team.teamStatus === "DISQUALIFIED") {
    return { malpracticeCount: team.malpracticeCount, terminated: true };
  }

  const severity = EVENT_SEVERITY[eventType] ?? "LOW";

  // Check the most recent recorded malpractice event for this team to throttle rapid bursts / correlated incidents.
  const [latestEvent] = await db
    .select({ occurredAt: malpracticeEvents.occurredAt, eventType: malpracticeEvents.eventType })
    .from(malpracticeEvents)
    .where(eq(malpracticeEvents.teamId, teamId))
    .orderBy(desc(malpracticeEvents.occurredAt))
    .limit(1);

  const now = Date.now();
  const lastTime = latestEvent?.occurredAt ? new Date(latestEvent.occurredAt).getTime() : 0;
  const elapsed = now - lastTime;

  const isExitEvent = EXIT_EVENTS.includes(eventType);
  const wasLastExitEvent = latestEvent ? EXIT_EVENTS.includes(latestEvent.eventType as MalpracticeEventType) : false;

  // Correlated exit events (e.g., blur + tab switch + fullscreen exit on mobile)
  // or events occurring within the incident cooldown window are logged for audit,
  // but do not increment strikes more than once per incident.
  const isThrottled = elapsed < INCIDENT_COOLDOWN_MS && (isExitEvent || wasLastExitEvent || elapsed < 1500);

  if (isThrottled) {
    await db.insert(malpracticeEvents).values({
      teamId,
      sessionId: sessionId ?? null,
      round,
      eventType,
      questionId: questionId ?? null,
      metadata: {
        ...(metadata ?? {}),
        throttled: true,
        cooldownElapsedMs: elapsed,
      },
      severity,
    });

    return { malpracticeCount: team.malpracticeCount, terminated: false, throttled: true };
  }

  // Record non-throttled event and award 1 malpractice strike
  await db.insert(malpracticeEvents).values({
    teamId,
    sessionId: sessionId ?? null,
    round,
    eventType,
    questionId: questionId ?? null,
    metadata: metadata ?? {},
    severity,
  });

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
