import type { Team } from "@/lib/team-auth";

/** Safe, participant-facing view of a team — never leak session tokens etc. */
export function publicTeam(team: Team) {
  return {
    id: team.id,
    teamCode: team.teamCode,
    teamName: team.teamName,
    members: [team.member1Name, team.member2Name, team.member3Name, team.member4Name].filter(Boolean),
    collegeDept: team.collegeDept,
    teamStatus: team.teamStatus,
    qualifiedForRound2: team.qualifiedForRound2,
    currentRound: team.currentRound,
    scoreRound1: team.scoreRound1,
    scoreRound2: team.scoreRound2,
    totalScore: team.totalScore,
    malpracticeCount: team.malpracticeCount,
    quizStartedAt: team.quizStartedAt,
    quizCompletedAt: team.quizCompletedAt,
    round2StartedAt: team.round2StartedAt,
    round2CompletedAt: team.round2CompletedAt,
  };
}
