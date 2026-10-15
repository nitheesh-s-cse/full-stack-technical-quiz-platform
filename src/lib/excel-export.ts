import * as XLSX from "xlsx";

export type FormatTeamRow = {
  id: number;
  teamCode: string;
  teamName: string;
  member1Name: string | null;
  member2Name: string | null;
  member3Name: string | null;
  member4Name: string | null;
  collegeDept: string | null;
  registrationStatus: string;
  qualifiedForRound2: boolean;
  currentRound: number;
  scoreRound1: number;
  scoreRound2: number;
  scoreTieBreaker: number;
  totalScore: number;
  malpracticeCount: number;
  teamStatus: string;
  deviceInfo: string | null;
  terminationReason: string | null;
  quizStartedAt: Date | string | null;
  quizCompletedAt: Date | string | null;
  round2StartedAt: Date | string | null;
  round2CompletedAt: Date | string | null;
  tieBreakerStartedAt: Date | string | null;
  tieBreakerCompletedAt: Date | string | null;
  createdAt: Date | string;
  lastSeenAt: Date | string | null;
};

export type FormatSession = {
  id: number;
  teamId: number;
  round: number;
  status: string;
  durationMinutes: number;
  startedAt: Date | string;
  completedAt: Date | string | null;
  endsAt: Date | string;
  score: number;
  questionOrder?: unknown;
};

export type FormatAnswer = {
  id: number;
  sessionId: number;
  teamId: number;
  questionId: number;
  round: number;
  selectedLabel: string | null;
  isCorrect: boolean | null;
  marksAwarded: number;
  answeredAt: Date | string;
};

export type FormatMalpractice = {
  id: number;
  teamId: number;
  sessionId: number | null;
  round: number;
  eventType: string;
  severity: string;
  questionId: number | null;
  metadata: unknown;
  adminAcknowledged: boolean;
  occurredAt: Date | string;
};

export type FormatQuestion = {
  id: number;
  round: number;
  language: string;
  difficulty: string;
  questionText: string;
  correctOption: string;
  marks: number;
  negativeMarks: number;
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDuration(start: Date | string | null | undefined, end: Date | string | null | undefined): string {
  if (!start || !end) return "-";
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return "-";
  const totalSec = Math.floor((e - s) / 1000);
  const m = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${m}m ${sec}s`;
}

function calculateColumnWidths(data: Record<string, unknown>[], minW = 12): XLSX.ColInfo[] {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]);
  return keys.map((key) => {
    let max = key.length;
    for (const row of data) {
      const val = row[key];
      const str = val === null || val === undefined ? "" : String(val);
      if (str.length > max) max = str.length;
    }
    return { wch: Math.min(Math.max(max + 3, minW), 55) };
  });
}

export function generateEventExcelWorkbook({
  teams,
  sessions,
  answers,
  malpracticeEvents,
  questions,
  sheet = "all",
}: {
  teams: FormatTeamRow[];
  sessions: FormatSession[];
  answers: FormatAnswer[];
  malpracticeEvents: FormatMalpractice[];
  questions: FormatQuestion[];
  sheet?: "all" | "master" | "roster" | "round1" | "round2" | "tiebreaker" | "malpractice" | "questions";
}): Buffer {
  const wb = XLSX.utils.book_new();

  // Map teams and sessions
  const teamMap = new Map<number, FormatTeamRow>(teams.map((t) => [t.id, t]));
  const sessionsByTeamRound = new Map<string, FormatSession>();
  for (const s of sessions) {
    sessionsByTeamRound.set(`${s.teamId}-${s.round}`, s);
  }

  // Group answers by team & round
  const answersByTeamRound = new Map<string, FormatAnswer[]>();
  for (const a of answers) {
    const key = `${a.teamId}-${a.round}`;
    const list = answersByTeamRound.get(key) ?? [];
    list.push(a);
    answersByTeamRound.set(key, list);
  }

  // Group malpractice events by team
  const malpracticesByTeam = new Map<number, FormatMalpractice[]>();
  for (const m of malpracticeEvents) {
    const list = malpracticesByTeam.get(m.teamId) ?? [];
    list.push(m);
    malpracticesByTeam.set(m.teamId, list);
  }

  // Sort teams for overall leaderboard
  const sortedTeams = [...teams].sort((a, b) => {
    const aTotal = Math.max(0, a.totalScore);
    const bTotal = Math.max(0, b.totalScore);
    if (bTotal !== aTotal) return bTotal - aTotal;
    const aTie = Math.max(0, a.scoreTieBreaker);
    const bTie = Math.max(0, b.scoreTieBreaker);
    if (bTie !== aTie) return bTie - aTie;
    if (a.malpracticeCount !== b.malpracticeCount) return a.malpracticeCount - b.malpracticeCount;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Assign overall ranks
  let lastScore: number | null = null;
  let lastTieScore: number | null = null;
  let lastRank = 0;
  const teamRanks = new Map<number, number>();

  sortedTeams.forEach((t, idx) => {
    const scoreVal = Math.max(0, t.totalScore);
    const tieVal = Math.max(0, t.scoreTieBreaker);
    const scoreChanged = scoreVal !== lastScore;
    const tieChanged = tieVal !== lastTieScore;
    if (idx === 0 || scoreChanged || tieChanged) {
      lastRank = idx + 1;
      lastScore = scoreVal;
      lastTieScore = tieVal;
    }
    teamRanks.set(t.id, lastRank);
  });

  // -------------------------------------------------------------
  // Sheet 1: Master Leaderboard & Scores
  // -------------------------------------------------------------
  const masterData = sortedTeams.map((t) => {
    const rank = teamRanks.get(t.id) ?? "-";
    const membersList = [t.member1Name, t.member2Name, t.member3Name, t.member4Name].filter(Boolean);
    const r1Session = sessionsByTeamRound.get(`${t.id}-1`);
    const r2Session = sessionsByTeamRound.get(`${t.id}-2`);
    const tbSession = sessionsByTeamRound.get(`${t.id}-3`);

    return {
      "Rank": typeof rank === "number" ? `#${rank}` : rank,
      "Team ID": t.teamCode,
      "Team Name": t.teamName,
      "College / Dept": t.collegeDept || "Not Specified",
      "Total Score": Math.max(0, t.totalScore),
      "Round 1 Score": Math.max(0, t.scoreRound1),
      "Round 2 Score": Math.max(0, t.scoreRound2),
      "Tie-Breaker Score": Math.max(0, t.scoreTieBreaker),
      "Status": t.teamStatus,
      "Round 2 Qualified": t.qualifiedForRound2 ? "YES" : "NO",
      "Malpractice Count": t.malpracticeCount,
      "Total Members": membersList.length,
      "Member 1": t.member1Name || "-",
      "Member 2": t.member2Name || "-",
      "Member 3": t.member3Name || "-",
      "Member 4": t.member4Name || "-",
      "Round 1 Status": r1Session?.status ?? (t.quizCompletedAt ? "COMPLETED" : "NOT STARTED"),
      "Round 1 Time Taken": formatDuration(t.quizStartedAt ?? r1Session?.startedAt, t.quizCompletedAt ?? r1Session?.completedAt),
      "Round 2 Status": r2Session?.status ?? (t.round2CompletedAt ? "COMPLETED" : "NOT STARTED"),
      "Round 2 Time Taken": formatDuration(t.round2StartedAt ?? r2Session?.startedAt, t.round2CompletedAt ?? r2Session?.completedAt),
      "Tie-Breaker Status": tbSession?.status ?? (t.tieBreakerCompletedAt ? "COMPLETED" : "-"),
      "Tie-Breaker Time Taken": formatDuration(t.tieBreakerStartedAt ?? tbSession?.startedAt, t.tieBreakerCompletedAt ?? tbSession?.completedAt),
      "Termination Reason": t.terminationReason || "-",
      "Registered On": formatDate(t.createdAt),
      "Last Seen": formatDate(t.lastSeenAt),
    };
  });

  const wsMaster = XLSX.utils.json_to_sheet(masterData);
  wsMaster["!cols"] = calculateColumnWidths(masterData, 14);
  if (sheet === "all" || sheet === "master") {
    XLSX.utils.book_append_sheet(wb, wsMaster, "Master Leaderboard");
  }

  // -------------------------------------------------------------
  // Sheet 2: Participants Roster (Row per student/member)
  // -------------------------------------------------------------
  const rosterData: Record<string, unknown>[] = [];
  let sNo = 1;
  for (const t of sortedTeams) {
    const rank = teamRanks.get(t.id) ?? "-";
    const members = [
      { num: 1, name: t.member1Name },
      { num: 2, name: t.member2Name },
      { num: 3, name: t.member3Name },
      { num: 4, name: t.member4Name },
    ].filter((m) => m.name && m.name.trim().length > 0);

    if (members.length === 0) {
      rosterData.push({
        "S.No": sNo++,
        "Participant Name": "No members listed",
        "Role": "-",
        "Team ID": t.teamCode,
        "Team Name": t.teamName,
        "College / Dept": t.collegeDept || "-",
        "Team Rank": typeof rank === "number" ? `#${rank}` : rank,
        "Total Score": Math.max(0, t.totalScore),
        "Round 1 Score": Math.max(0, t.scoreRound1),
        "Round 2 Score": Math.max(0, t.scoreRound2),
        "Tie-Breaker": Math.max(0, t.scoreTieBreaker),
        "Round 2 Qualified": t.qualifiedForRound2 ? "YES" : "NO",
        "Team Status": t.teamStatus,
      });
    } else {
      for (const m of members) {
        rosterData.push({
          "S.No": sNo++,
          "Participant Name": m.name,
          "Role": `Member ${m.num}${m.num === 1 ? " (Lead)" : ""}`,
          "Team ID": t.teamCode,
          "Team Name": t.teamName,
          "College / Dept": t.collegeDept || "-",
          "Team Rank": typeof rank === "number" ? `#${rank}` : rank,
          "Total Score": Math.max(0, t.totalScore),
          "Round 1 Score": Math.max(0, t.scoreRound1),
          "Round 2 Score": Math.max(0, t.scoreRound2),
          "Tie-Breaker": Math.max(0, t.scoreTieBreaker),
          "Round 2 Qualified": t.qualifiedForRound2 ? "YES" : "NO",
          "Team Status": t.teamStatus,
        });
      }
    }
  }

  const wsRoster = XLSX.utils.json_to_sheet(rosterData);
  wsRoster["!cols"] = calculateColumnWidths(rosterData, 14);
  if (sheet === "all" || sheet === "roster") {
    XLSX.utils.book_append_sheet(wb, wsRoster, "Participants Roster");
  }

  // -------------------------------------------------------------
  // Sheet 3: Round 1 Detailed
  // -------------------------------------------------------------
  const round1Teams = [...teams].sort((a, b) => {
    if (b.scoreRound1 !== a.scoreRound1) return b.scoreRound1 - a.scoreRound1;
    return (a.quizCompletedAt ? new Date(a.quizCompletedAt).getTime() : Infinity) -
      (b.quizCompletedAt ? new Date(b.quizCompletedAt).getTime() : Infinity);
  });

  const round1Data = round1Teams.map((t, idx) => {
    const r1Answers = answersByTeamRound.get(`${t.id}-1`) ?? [];
    const r1Session = sessionsByTeamRound.get(`${t.id}-1`);
    const correctCount = r1Answers.filter((a) => a.isCorrect === true).length;
    const answeredCount = r1Answers.filter((a) => a.selectedLabel !== null).length;
    const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    const malpractices = (malpracticesByTeam.get(t.id) ?? []).filter((m) => m.round === 1).length;

    return {
      "Round 1 Rank": `#${idx + 1}`,
      "Team ID": t.teamCode,
      "Team Name": t.teamName,
      "College / Dept": t.collegeDept || "-",
      "Round 1 Score": Math.max(0, t.scoreRound1),
      "Attempted Questions": answeredCount,
      "Correct Answers": correctCount,
      "Incorrect Answers": answeredCount - correctCount,
      "Accuracy Rate": answeredCount > 0 ? `${accuracy}%` : "-",
      "Session Status": r1Session?.status ?? (t.quizCompletedAt ? "COMPLETED" : "NOT STARTED"),
      "Qualified for Round 2": t.qualifiedForRound2 ? "QUALIFIED" : "NOT QUALIFIED",
      "Malpractices in R1": malpractices,
      "Started At": formatDate(t.quizStartedAt ?? r1Session?.startedAt),
      "Completed At": formatDate(t.quizCompletedAt ?? r1Session?.completedAt),
      "Time Taken": formatDuration(t.quizStartedAt ?? r1Session?.startedAt, t.quizCompletedAt ?? r1Session?.completedAt),
      "Allocated Minutes": r1Session?.durationMinutes ?? 30,
    };
  });

  const wsRound1 = XLSX.utils.json_to_sheet(round1Data);
  wsRound1["!cols"] = calculateColumnWidths(round1Data, 14);
  if (sheet === "all" || sheet === "round1") {
    XLSX.utils.book_append_sheet(wb, wsRound1, "Round 1 - Prelims");
  }

  // -------------------------------------------------------------
  // Sheet 4: Round 2 Detailed
  // -------------------------------------------------------------
  const round2Teams = teams
    .filter((t) => t.qualifiedForRound2 || t.round2StartedAt || t.scoreRound2 > 0)
    .sort((a, b) => {
      const aR2 = Math.max(0, a.scoreRound2);
      const bR2 = Math.max(0, b.scoreRound2);
      if (bR2 !== aR2) return bR2 - aR2;
      return (a.round2CompletedAt ? new Date(a.round2CompletedAt).getTime() : Infinity) -
        (b.round2CompletedAt ? new Date(b.round2CompletedAt).getTime() : Infinity);
    });

  const round2Data = round2Teams.map((t, idx) => {
    const r2Answers = answersByTeamRound.get(`${t.id}-2`) ?? [];
    const r2Session = sessionsByTeamRound.get(`${t.id}-2`);
    const correctCount = r2Answers.filter((a) => a.isCorrect === true).length;
    const answeredCount = r2Answers.filter((a) => a.selectedLabel !== null).length;
    const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    const malpractices = (malpracticesByTeam.get(t.id) ?? []).filter((m) => m.round === 2).length;

    return {
      "Round 2 Rank": `#${idx + 1}`,
      "Team ID": t.teamCode,
      "Team Name": t.teamName,
      "College / Dept": t.collegeDept || "-",
      "Round 2 Score": Math.max(0, t.scoreRound2),
      "Attempted Questions": answeredCount,
      "Correct Answers": correctCount,
      "Incorrect Answers": answeredCount - correctCount,
      "Accuracy Rate": answeredCount > 0 ? `${accuracy}%` : "-",
      "Session Status": r2Session?.status ?? (t.round2CompletedAt ? "COMPLETED" : "IN PROGRESS / NOT STARTED"),
      "Malpractices in R2": malpractices,
      "Started At": formatDate(t.round2StartedAt ?? r2Session?.startedAt),
      "Completed At": formatDate(t.round2CompletedAt ?? r2Session?.completedAt),
      "Time Taken": formatDuration(t.round2StartedAt ?? r2Session?.startedAt, t.round2CompletedAt ?? r2Session?.completedAt),
      "Allocated Minutes": r2Session?.durationMinutes ?? 20,
    };
  });

  const wsRound2 = XLSX.utils.json_to_sheet(round2Data.length ? round2Data : [{ "Notice": "No Round 2 participants or submissions yet." }]);
  wsRound2["!cols"] = calculateColumnWidths(round2Data, 14);
  if (sheet === "all" || sheet === "round2") {
    XLSX.utils.book_append_sheet(wb, wsRound2, "Round 2 - Finals");
  }

  // -------------------------------------------------------------
  // Sheet 5: Tie-Breaker Details
  // -------------------------------------------------------------
  const tbTeams = teams
    .filter((t) => t.tieBreakerStartedAt || t.scoreTieBreaker > 0)
    .sort((a, b) => Math.max(0, b.scoreTieBreaker) - Math.max(0, a.scoreTieBreaker));

  const tbData = tbTeams.map((t, idx) => {
    const tbSession = sessionsByTeamRound.get(`${t.id}-3`);
    return {
      "Tie-Breaker Rank": `#${idx + 1}`,
      "Team ID": t.teamCode,
      "Team Name": t.teamName,
      "College / Dept": t.collegeDept || "-",
      "Tie-Breaker Score": Math.max(0, t.scoreTieBreaker),
      "Status": tbSession?.status ?? (t.tieBreakerCompletedAt ? "COMPLETED" : "ACTIVE"),
      "Started At": formatDate(t.tieBreakerStartedAt ?? tbSession?.startedAt),
      "Completed At": formatDate(t.tieBreakerCompletedAt ?? tbSession?.completedAt),
      "Time Taken": formatDuration(t.tieBreakerStartedAt ?? tbSession?.startedAt, t.tieBreakerCompletedAt ?? tbSession?.completedAt),
    };
  });

  const wsTb = XLSX.utils.json_to_sheet(tbData.length ? tbData : [{ "Notice": "No Tie-Breaker participants or submissions yet." }]);
  wsTb["!cols"] = calculateColumnWidths(tbData, 14);
  if (sheet === "all" || sheet === "tiebreaker") {
    XLSX.utils.book_append_sheet(wb, wsTb, "Tie-Breaker");
  }

  // -------------------------------------------------------------
  // Sheet 6: Malpractice & Security Incidents
  // -------------------------------------------------------------
  const malpracticeData = malpracticeEvents.map((m, idx) => {
    const team = teamMap.get(m.teamId);
    let details = "-";
    if (m.metadata && typeof m.metadata === "object") {
      try {
        details = JSON.stringify(m.metadata);
      } catch {
        details = String(m.metadata);
      }
    }

    return {
      "Incident #": idx + 1,
      "Timestamp": formatDate(m.occurredAt),
      "Team ID": team?.teamCode ?? String(m.teamId),
      "Team Name": team?.teamName ?? "-",
      "College / Dept": team?.collegeDept ?? "-",
      "Round": m.round === 3 ? "Tie-Breaker" : `Round ${m.round}`,
      "Incident Type": m.eventType,
      "Severity": m.severity,
      "Question ID": m.questionId ?? "-",
      "Admin Acknowledged": m.adminAcknowledged ? "YES" : "NO",
      "Event Details": details,
    };
  });

  const wsMalpractice = XLSX.utils.json_to_sheet(malpracticeData.length ? malpracticeData : [{ "Notice": "No malpractice incidents recorded. Clean competition!" }]);
  wsMalpractice["!cols"] = calculateColumnWidths(malpracticeData, 14);
  if (sheet === "all" || sheet === "malpractice") {
    XLSX.utils.book_append_sheet(wb, wsMalpractice, "Malpractice Log");
  }

  // -------------------------------------------------------------
  // Sheet 7: Question Analytics
  // -------------------------------------------------------------
  const qMapAnswers = new Map<number, FormatAnswer[]>();
  for (const a of answers) {
    const list = qMapAnswers.get(a.questionId) ?? [];
    list.push(a);
    qMapAnswers.set(a.questionId, list);
  }

  const questionData = questions.map((q) => {
    const qAnswers = qMapAnswers.get(q.id) ?? [];
    const totalAttempts = qAnswers.filter((a) => a.selectedLabel !== null).length;
    const correctAttempts = qAnswers.filter((a) => a.isCorrect === true).length;
    const wrongAttempts = totalAttempts - correctAttempts;
    const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    return {
      "Question ID": q.id,
      "Round": q.round === 3 ? "Tie-Breaker" : `Round ${q.round}`,
      "Language": q.language.toUpperCase(),
      "Difficulty": q.difficulty.toUpperCase(),
      "Marks": q.marks,
      "Negative Marks": q.negativeMarks,
      "Total Attempts": totalAttempts,
      "Correct Answers": correctAttempts,
      "Wrong Answers": wrongAttempts,
      "Accuracy Rate": totalAttempts > 0 ? `${accuracy}%` : "-",
      "Question Prompt": q.questionText,
      "Correct Option": q.correctOption,
    };
  });

  const wsQuestions = XLSX.utils.json_to_sheet(questionData.length ? questionData : [{ "Notice": "No questions loaded." }]);
  wsQuestions["!cols"] = calculateColumnWidths(questionData, 14);
  if (sheet === "all" || sheet === "questions") {
    XLSX.utils.book_append_sheet(wb, wsQuestions, "Question Analytics");
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function generateSingleTeamExcelWorkbook({
  team,
  rounds,
  malpracticeEvents,
}: {
  team: FormatTeamRow;
  rounds: {
    round: number;
    status: string;
    startedAt: string | Date;
    completedAt: string | Date | null;
    score: number;
    durationMinutes: number;
    questions: {
      position: number;
      questionId: number;
      language: string;
      difficulty: string;
      questionText: string;
      selectedLabel: string | null;
      correctLabel: string | null;
      isCorrect: boolean | null;
      marksAwarded: number;
      marks: number;
    }[];
  }[];
  malpracticeEvents: FormatMalpractice[];
}): Buffer {
  const wb = XLSX.utils.book_new();

  // 1. Team Profile Sheet
  const profileData = [
    { Field: "Team ID", Value: team.teamCode },
    { Field: "Team Name", Value: team.teamName },
    { Field: "College / Department", Value: team.collegeDept || "-" },
    { Field: "Current Status", Value: team.teamStatus },
    { Field: "Qualified for Round 2", Value: team.qualifiedForRound2 ? "YES" : "NO" },
    { Field: "Total Score", Value: Math.max(0, team.totalScore) },
    { Field: "Round 1 Score", Value: Math.max(0, team.scoreRound1) },
    { Field: "Round 2 Score", Value: Math.max(0, team.scoreRound2) },
    { Field: "Tie-Breaker Score", Value: Math.max(0, team.scoreTieBreaker) },
    { Field: "Malpractice Alerts Count", Value: team.malpracticeCount },
    { Field: "Termination Reason", Value: team.terminationReason || "-" },
    { Field: "Member 1 (Lead)", Value: team.member1Name || "-" },
    { Field: "Member 2", Value: team.member2Name || "-" },
    { Field: "Member 3", Value: team.member3Name || "-" },
    { Field: "Member 4", Value: team.member4Name || "-" },
    { Field: "Round 1 Started At", Value: formatDate(team.quizStartedAt) },
    { Field: "Round 1 Completed At", Value: formatDate(team.quizCompletedAt) },
    { Field: "Round 2 Started At", Value: formatDate(team.round2StartedAt) },
    { Field: "Round 2 Completed At", Value: formatDate(team.round2CompletedAt) },
    { Field: "Registration Date", Value: formatDate(team.createdAt) },
    { Field: "Last Seen", Value: formatDate(team.lastSeenAt) },
  ];

  const wsProfile = XLSX.utils.json_to_sheet(profileData);
  wsProfile["!cols"] = [{ wch: 25 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsProfile, "Team Summary");

  // 2. Round Question Sheets
  for (const r of rounds) {
    const roundName = r.round === 3 ? "Tie-Breaker Answers" : `Round ${r.round} Answers`;
    const qRows = r.questions.map((q) => ({
      "Question #": q.position,
      "Question ID": q.questionId,
      "Language": q.language.toUpperCase(),
      "Difficulty": q.difficulty.toUpperCase(),
      "Question Text": q.questionText,
      "Selected Option": q.selectedLabel || "Skipped / Unanswered",
      "Correct Option": q.correctLabel || "-",
      "Result": q.isCorrect === true ? "CORRECT" : q.selectedLabel ? "WRONG" : "UNANSWERED",
      "Marks Awarded": q.marksAwarded,
      "Max Marks": q.marks,
    }));

    const wsR = XLSX.utils.json_to_sheet(qRows.length ? qRows : [{ "Notice": "No questions answered for this round." }]);
    wsR["!cols"] = calculateColumnWidths(qRows, 14);
    XLSX.utils.book_append_sheet(wb, wsR, roundName);
  }

  // 3. Malpractice sheet
  if (malpracticeEvents.length > 0) {
    const mRows = malpracticeEvents.map((m, idx) => ({
      "Incident #": idx + 1,
      "Timestamp": formatDate(m.occurredAt),
      "Round": m.round === 3 ? "Tie-Breaker" : `Round ${m.round}`,
      "Event Type": m.eventType,
      "Severity": m.severity,
      "Question ID": m.questionId ?? "-",
      "Acknowledged": m.adminAcknowledged ? "YES" : "NO",
      "Details": typeof m.metadata === "object" ? JSON.stringify(m.metadata) : String(m.metadata ?? "-"),
    }));

    const wsM = XLSX.utils.json_to_sheet(mRows);
    wsM["!cols"] = calculateColumnWidths(mRows, 14);
    XLSX.utils.book_append_sheet(wb, wsM, "Malpractice Logs");
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
