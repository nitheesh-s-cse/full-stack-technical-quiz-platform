import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams, quizSessions, quizAnswers, malpracticeEvents, questions } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { generateEventExcelWorkbook } from "@/lib/excel-export";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized. Admin authentication required." }, { status: 401 });
  }

  try {
    const sheetParam = (req.nextUrl.searchParams.get("sheet") || "all") as
      | "all"
      | "master"
      | "roster"
      | "round1"
      | "round2"
      | "tiebreaker"
      | "malpractice"
      | "questions";

    const allTeams = await db.select().from(teams).orderBy(desc(teams.createdAt));
    const allSessions = await db.select().from(quizSessions);
    const allAnswers = await db.select().from(quizAnswers);
    const allMalpractices = await db.select().from(malpracticeEvents).orderBy(desc(malpracticeEvents.occurredAt));
    const allQuestions = await db.select().from(questions);

    const buffer = generateEventExcelWorkbook({
      teams: allTeams,
      sessions: allSessions,
      answers: allAnswers,
      malpracticeEvents: allMalpractices,
      questions: allQuestions,
      sheet: sheetParam,
    });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${now.getHours().toString().padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}`;
    const prefix =
      sheetParam === "master"
        ? "Leaderboard_Export"
        : sheetParam === "roster"
        ? "Participants_Roster"
        : sheetParam === "round1"
        ? "Round1_Scores"
        : sheetParam === "round2"
        ? "Round2_Scores"
        : sheetParam === "tiebreaker"
        ? "TieBreaker_Scores"
        : sheetParam === "malpractice"
        ? "Malpractice_Log"
        : sheetParam === "questions"
        ? "Question_Analytics"
        : "Quiz_Full_Report";

    const filename = `${prefix}_${dateStr}_${timeStr}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: unknown) {
    console.error("Export error:", err);
    const msg = err instanceof Error ? err.message : "Failed to generate Excel export";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
