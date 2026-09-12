import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function rankify<T extends { score: number }>(rows: T[]) {
  let lastScore: number | null = null;
  let lastRank = 0;
  return rows.map((row, idx) => {
    if (row.score !== lastScore) {
      lastRank = idx + 1;
      lastScore = row.score;
    }
    return { ...row, rank: lastRank };
  });
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const mode = req.nextUrl.searchParams.get("mode") ?? "final";
  const allTeams = await db.select().from(teams);

  if (mode === "round1") {
    const rows = allTeams
      .filter((t) => t.quizCompletedAt)
      .map((t) => ({
        teamId: t.id,
        teamCode: t.teamCode,
        teamName: t.teamName,
        score: t.scoreRound1,
        malpracticeCount: t.malpracticeCount,
        status: t.teamStatus,
        qualifiedForRound2: t.qualifiedForRound2,
      }))
      .sort((a, b) => b.score - a.score);
    return NextResponse.json({ leaderboard: rankify(rows) });
  }

  if (mode === "round2") {
    const rows = allTeams
      .filter((t) => t.round2CompletedAt)
      .map((t) => ({
        teamId: t.id,
        teamCode: t.teamCode,
        teamName: t.teamName,
        score: t.scoreRound2,
        malpracticeCount: t.malpracticeCount,
        status: t.teamStatus,
      }))
      .sort((a, b) => b.score - a.score);
    return NextResponse.json({ leaderboard: rankify(rows) });
  }

  const rows = allTeams
    .map((t) => ({
      teamId: t.id,
      teamCode: t.teamCode,
      teamName: t.teamName,
      scoreRound1: t.scoreRound1,
      scoreRound2: t.scoreRound2,
      score: t.totalScore,
      malpracticeCount: t.malpracticeCount,
      status: t.teamStatus,
      qualifiedForRound2: t.qualifiedForRound2,
    }))
    .sort((a, b) => b.score - a.score);
  return NextResponse.json({ leaderboard: rankify(rows) });
}
