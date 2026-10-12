import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function rankify<T extends { score: number; scoreTieBreaker?: number }>(rows: T[]) {
  let lastScore: number | null = null;
  let lastTieScore: number | null = null;
  let lastRank = 0;
  return rows.map((row, idx) => {
    const scoreChanged = row.score !== lastScore;
    const tieChanged = row.scoreTieBreaker !== undefined && row.scoreTieBreaker !== lastTieScore;
    if (idx === 0 || scoreChanged || tieChanged) {
      lastRank = idx + 1;
      lastScore = row.score;
      lastTieScore = row.scoreTieBreaker ?? null;
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

  if (mode === "tiebreaker") {
    const rows = allTeams
      .filter((t) => t.tieBreakerCompletedAt || t.scoreTieBreaker > 0)
      .map((t) => ({
        teamId: t.id,
        teamCode: t.teamCode,
        teamName: t.teamName,
        score: t.scoreTieBreaker,
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
      scoreTieBreaker: t.scoreTieBreaker,
      score: t.totalScore,
      malpracticeCount: t.malpracticeCount,
      status: t.teamStatus,
      qualifiedForRound2: t.qualifiedForRound2,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.scoreTieBreaker !== a.scoreTieBreaker) return b.scoreTieBreaker - a.scoreTieBreaker;
      return a.malpracticeCount - b.malpracticeCount;
    });
  return NextResponse.json({ leaderboard: rankify(rows) });
}
