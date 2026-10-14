// scripts/qa-e2e-api.mjs
// Isolated end-to-end API harness for OUTPUT HUNT.
// Runs ONLY against the LOCAL test DB (5433) and a dev server bound to it.
// Never touches production. Reads each session's shuffled optionKeys from the
// DB so we can submit a genuinely correct/incorrect displayed label.
import { Client } from "pg";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3400";
const DB_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/app_db_test";

const OPTION_LABELS = ["A", "B", "C", "D"];
const ADMIN = { username: "admin", password: "JustPassword@2026" };

const pg = new Client({ connectionString: DB_URL });
await pg.connect();

const lines = [];
let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
    lines.push(`PASS  ${name}`);
  } else {
    fail++;
    lines.push(`FAIL  ${name}${detail ? "  :: " + detail : ""}`);
  }
}

function client() {
  let cookie = "";
  return {
    async req(path, opts = {}) {
      const headers = { ...(opts.headers || {}) };
      if (opts.json !== undefined) headers["content-type"] = "application/json";
      if (cookie) headers["cookie"] = cookie;
      const res = await fetch(BASE + path, {
        method: opts.method || (opts.json !== undefined ? "POST" : "GET"),
        headers,
        body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
      });
      const sc = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
      for (const c of sc) {
        if (c.startsWith("oh_team_session=") || c.startsWith("oh_admin_session=")) {
          cookie = c.split(";")[0];
        }
      }
      let body = null;
      try {
        body = await res.json();
      } catch {}
      return { status: res.status, body };
    },
  };
}

async function ensureTeam(code, name) {
  await pg.query(
    `insert into teams (team_code, team_name, member_1_name, member_2_name, college_dept)
     values ($1,$2,'QA M1','QA M2','CSE')
     on conflict (team_code) do nothing`,
    [code, name],
  );
  const r = await pg.query(`select id from teams where team_code=$1`, [code]);
  const id = r.rows[0].id;
  // Reset for repeatability (test DB only)
  await pg.query(`delete from quiz_answers where team_id=$1`, [id]);
  await pg.query(`delete from quiz_sessions where team_id=$1`, [id]);
  await pg.query(
    `update teams set active_login_token_hash=null, current_round=1, score_round_1=0, score_round_2=0,
      score_tie_breaker=0, total_score=0, qualified_for_round_2=false, round2_completed_at=null,
      quiz_completed_at=null, team_status='REGISTERED' where id=$1`,
    [id],
  );
  return id;
}

async function orderFor(sessionId) {
  const r = await pg.query(`select question_order from quiz_sessions where id=$1`, [sessionId]);
  return r.rows[0].question_order;
}
async function correctOpt(qid) {
  const r = await pg.query(`select correct_option from questions where id=$1`, [qid]);
  return r.rows[0].correct_option;
}
function labelForCorrect(order, qid, correctOption) {
  const e = order.find((x) => x.questionId === qid);
  return OPTION_LABELS[e.optionKeys.indexOf(correctOption)];
}
function labelForWrong(order, qid, correctOption) {
  const e = order.find((x) => x.questionId === qid);
  const idx = e.optionKeys.indexOf(correctOption);
  return OPTION_LABELS[(idx + 1) % 4];
}

async function main() {
  // Reset isolated test teams (test DB only; never production)
  const teamA = await ensureTeam("QAA01", "QA Alpha");
  const teamB = await ensureTeam("QAB01", "QA Beta");

  const anon = client();
  const admin = client();
  const team = client();
  const team2 = client();

  // ---------------- PHASE A: Auth & Authorization ----------------
  const sAnon = await anon.req("/api/quiz/start", { json: { round: 1 } });
  check("A1 unauthenticated /start -> 401", sAnon.status === 401, `got ${sAnon.status}`);
  const stAnon = await anon.req("/api/quiz/state?round=1");
  check("A2 unauthenticated /state -> 401", stAnon.status === 401, `got ${stAnon.status}`);
  const lbAnon = await anon.req("/api/admin/leaderboard");
  check("A3 unauthenticated /admin/leaderboard -> 401", lbAnon.status === 401, `got ${lbAnon.status}`);

  const badAdmin = await admin.req("/api/admin/login", { json: { username: "admin", password: "wrong-pass" } });
  check("A4 admin bad password -> 401", badAdmin.status === 401, `got ${badAdmin.status}`);
  const goodAdmin = await admin.req("/api/admin/login", { json: ADMIN });
  check("A5 admin good login -> 200 + cookie", goodAdmin.status === 200 && !!goodAdmin.body?.admin?.username, JSON.stringify(goodAdmin.body));
  const settingsGet = await admin.req("/api/admin/settings");
  check("A6 admin settings GET -> 200", settingsGet.status === 200 && !!settingsGet.body?.settings, `got ${settingsGet.status}`);

  const unknownTeam = await team2.req("/api/team/login", { json: { teamCode: "NOEXIST" } });
  check("A7 team login unregistered -> 404", unknownTeam.status === 404, `got ${unknownTeam.status}`);

  // ---------------- PHASE B: Round 1 gating + start + leakage ----------------
  const enableR1 = await admin.req("/api/admin/settings", { json: { round1Enabled: true, round1DurationMinutes: 30 } });
  check("B0 admin enable round1 -> 200", enableR1.status === 200, `got ${enableR1.status}`);

  const loginA = await team.req("/api/team/login", { json: { teamCode: "QAA01" } });
  check("B1 team login valid -> 200", loginA.status === 200 && !!loginA.body?.team?.teamCode, JSON.stringify(loginA.body));

  const start1 = await team.req("/api/quiz/start", { json: { round: 1 } });
  check("B2 start round1 -> 200", start1.status === 200, `got ${start1.status} ${JSON.stringify(start1.body)}`);
  const sid = start1.body?.sessionId;
  const qs = start1.body?.questions ?? [];
  check("B3 round1 has 20 questions", qs.length === 20, `got ${qs.length}`);
  const startStr = JSON.stringify(start1.body);
  check("B4 no answerKey leak in /start", !startStr.includes("correctOption") && !startStr.includes("correct_option") && !startStr.includes("explanation"), "found leaked field");

  const state1 = await team.req("/api/quiz/state?round=1");
  check("B5 state round1 -> 200", state1.status === 200 && state1.body?.sessionId === sid, `got ${state1.status}`);
  const stateStr = JSON.stringify(state1.body);
  check("B6 no answerKey leak in /state", !stateStr.includes("correctOption") && !stateStr.includes("correct_option") && !stateStr.includes("explanation"), "found leaked field");
  const fourOpts = qs.every((q) => q.options && Object.keys(q.options).sort().join("") === "ABCD");
  check("B7 every question has 4 options A-D", fourOpts);

  const order1 = await orderFor(sid);
  check("B8 session order has 20 entries", Array.isArray(order1) && order1.length === 20, `got ${order1?.length}`);

  // ---------------- PHASE C: Answer validation (Round 1) ----------------
  const q0 = order1[0].questionId; // will answer CORRECT
  const q1 = order1[1].questionId; // will answer WRONG
  const r1q2 = 21; // exists but belongs to Round 2, not this session

  const cCorrect = await team.req("/api/quiz/answer", { json: { round: 1, questionId: q0, selectedLabel: labelForCorrect(order1, q0, await correctOpt(q0)) } });
  check("C1 submit correct answer -> 200 ok", cCorrect.status === 200 && cCorrect.body?.ok === true, `got ${cCorrect.status} ${JSON.stringify(cCorrect.body)}`);
  const cWrong = await team.req("/api/quiz/answer", { json: { round: 1, questionId: q1, selectedLabel: labelForWrong(order1, q1, await correctOpt(q1)) } });
  check("C2 submit incorrect answer -> 200 ok", cWrong.status === 200 && cWrong.body?.ok === true, `got ${cWrong.status}`);
  const cBadLabel = await team.req("/api/quiz/answer", { json: { round: 1, questionId: q0, selectedLabel: "Z" } });
  check("C3 invalid option label -> 400", cBadLabel.status === 400, `got ${cBadLabel.status}`);
  const cNoQid = await team.req("/api/quiz/answer", { json: { round: 1, selectedLabel: "A" } });
  check("C4 missing questionId -> 400", cNoQid.status === 400, `got ${cNoQid.status}`);
  const cBadRound = await team.req("/api/quiz/answer", { json: { round: 99, questionId: q0, selectedLabel: "A" } });
  check("C5 invalid round -> 400", cBadRound.status === 400, `got ${cBadRound.status}`);
  const cNotBelong = await team.req("/api/quiz/answer", { json: { round: 1, questionId: r1q2, selectedLabel: "A" } });
  check("C6 question not in session -> 400", cNotBelong.status === 400, `got ${cNotBelong.status}`);

  // Duplicate + concurrent submissions must not create multiple rows (last-write-wins).
  // Use a separate question (q2) so the q0-correct / q1-wrong scoring stays deterministic.
  const q2 = order1[2].questionId;
  await Promise.all([
    team.req("/api/quiz/answer", { json: { round: 1, questionId: q2, selectedLabel: "A" } }),
    team.req("/api/quiz/answer", { json: { round: 1, questionId: q2, selectedLabel: "B" } }),
    team.req("/api/quiz/answer", { json: { round: 1, questionId: q2, selectedLabel: "C" } }),
  ]);
  const dup = await pg.query(`select count(*)::int c from quiz_answers where session_id=$1 and question_id=$2`, [sid, q2]);
  check("C7 concurrent/duplicate submit -> single row", dup.rows[0].c === 1, `got ${dup.rows[0].c}`);
  // Deterministically set q2 to a wrong answer so scoring stays predictable (only q0 correct).
  await team.req("/api/quiz/answer", { json: { round: 1, questionId: q2, selectedLabel: labelForWrong(order1, q2, await correctOpt(q2)) } });

  // No score on team yet (session still ACTIVE, not finalized)
  const beforeScore = await pg.query(`select score_round_1, total_score from teams where id=$1`, [teamA]);
  check("C8 no score before finalize", beforeScore.rows[0].score_round_1 === 0 && beforeScore.rows[0].total_score === 0, JSON.stringify(beforeScore.rows[0]));

  // ---------------- PHASE D: Scoring, idempotent finalize, lockout ----------------
  // Answered q0 correct (+1) and q1 wrong (R1 neg=0 => 0). Expected score = 1.
  const sub1 = await team.req("/api/quiz/submit", { json: { round: 1 } });
  check("D1 submit round1 -> 200", sub1.status === 200, `got ${sub1.status} ${JSON.stringify(sub1.body)}`);
  check("D2 score == 1 (1 correct, R1 neg=0)", sub1.body?.score === 1, JSON.stringify(sub1.body));
  check("D3 correctCount == 1", sub1.body?.correctCount === 1, JSON.stringify(sub1.body));
  check("D4 totalQuestions == 20", sub1.body?.totalQuestions === 20, JSON.stringify(sub1.body));
  check("D5 alreadyFinalized == false", sub1.body?.alreadyFinalized === false, JSON.stringify(sub1.body));

  const sub1b = await team.req("/api/quiz/submit", { json: { round: 1 } });
  check("D6 re-submit -> alreadyFinalized true, same score", sub1b.body?.alreadyFinalized === true && sub1b.body?.score === 1, JSON.stringify(sub1b.body));

  const afterScore = await pg.query(`select score_round_1, total_score, quiz_completed_at from teams where id=$1`, [teamA]);
  check("D7 persisted score_round1 == 1", afterScore.rows[0].score_round_1 === 1, JSON.stringify(afterScore.rows[0]));
  check("D8 persisted total_score == 1", afterScore.rows[0].total_score === 1, JSON.stringify(afterScore.rows[0]));
  check("D9 quiz_completed_at set", !!afterScore.rows[0].quiz_completed_at, JSON.stringify(afterScore.rows[0]));

  const lateAnswer = await team.req("/api/quiz/answer", { json: { round: 1, questionId: order1[2].questionId, selectedLabel: "A" } });
  check("D10 late answer after finalize -> 409", lateAnswer.status === 409, `got ${lateAnswer.status}`);

  const restart = await team.req("/api/quiz/start", { json: { round: 1 } });
  check("D11 restart completed round -> 409", restart.status === 409, `got ${restart.status}`);

  // ---------------- PHASE E: Round gating + cross-participant isolation ----------------
  const loginB = await team2.req("/api/team/login", { json: { teamCode: "QAB01" } });
  check("E1 team B login -> 200", loginB.status === 200, `got ${loginB.status}`);
  const start2Denied = await team2.req("/api/quiz/start", { json: { round: 2 } });
  check("E2 round2 before qualified/enabled -> 403", start2Denied.status === 403, `got ${start2Denied.status}`);

  const qualifyB = await admin.req(`/api/admin/teams/${teamB}/qualify`, { json: { qualified: true } });
  check("E3 admin qualify team B -> 200", qualifyB.status === 200 && qualifyB.body?.ok === true, `got ${qualifyB.status}`);
  const enableR2 = await admin.req("/api/admin/settings", { json: { round2Enabled: true, round2DurationMinutes: 20 } });
  check("E4 admin enable round2 -> 200", enableR2.status === 200, `got ${enableR2.status}`);

  const startB2 = await team2.req("/api/quiz/start", { json: { round: 2 } });
  check("E5 team B starts round2 -> 200", startB2.status === 200, `got ${startB2.status} ${JSON.stringify(startB2.body)}`);
  const sidB = startB2.body?.sessionId;
  check("E6 team B round2 has 10 questions", (startB2.body?.questions?.length ?? 0) === 10, `got ${startB2.body?.questions?.length}`);

  const orderB = await orderFor(sidB);
  const bQ0 = orderB[0].questionId;
  const crossAnswer = await team.req("/api/quiz/answer", { json: { round: 2, questionId: bQ0, selectedLabel: "A" } });
  check("E7 team A answering round2 (no session) -> 404", crossAnswer.status === 404, `got ${crossAnswer.status}`);

  for (const idx of [0, 1]) {
    const qid = orderB[idx].questionId;
    const lbl = labelForCorrect(orderB, qid, await correctOpt(qid));
    await team2.req("/api/quiz/answer", { json: { round: 2, questionId: qid, selectedLabel: lbl } });
  }
  const subB = await team2.req("/api/quiz/submit", { json: { round: 2 } });
  check("E8 team B round2 score == 4 (2 correct x2)", subB.body?.score === 4, JSON.stringify(subB.body));

  // ================= Phase F: Java Tie-Breaker (Round 3) =================
  const enableTB = await admin.req("/api/admin/settings", { json: { tieBreakerEnabled: true, tieBreakerDurationMinutes: 15 } });
  check("F1 admin enable tie-breaker -> 200", enableTB.status === 200, `got ${enableTB.status}`);

  const startTB = await team2.req("/api/quiz/start", { json: { round: 3 } });
  check("F2 qualified team B starts round3 tie-breaker -> 200", startTB.status === 200, `got ${startTB.status} ${JSON.stringify(startTB.body)}`);
  const tbQs = startTB.body?.questions ?? [];
  check("F3 round3 has exactly 5 Java questions", tbQs.length === 5, `got ${tbQs.length}`);
  check("F4 all round3 questions are JAVA", tbQs.length > 0 && tbQs.every((x) => x.language === "JAVA"), JSON.stringify(tbQs.map((x) => x.language)));

  const leak = tbQs.some((x) => x.correctOption !== undefined || x.explanation !== undefined);
  check("F5 round3 does not leak correctOption/explanation", !leak, JSON.stringify(Object.keys(tbQs[0] || {})));

  const orderTB = await orderFor(startTB.body.sessionId);
  let tbSaved = 0;
  for (const idx of [0, 1]) {
    const qid = orderTB[idx].questionId;
    const lbl = labelForCorrect(orderTB, qid, await correctOpt(qid));
    const a = await team2.req("/api/quiz/answer", { json: { round: 3, questionId: qid, selectedLabel: lbl } });
    if (a.status === 200) tbSaved++;
  }
  check("F6 saved 2 tie-breaker answers", tbSaved === 2, `saved ${tbSaved}`);

  const subTB = await team2.req("/api/quiz/submit", { json: { round: 3 } });
  check("F7 round3 submit -> 200, score==4 (2 correct x2)", subTB.status === 200 && subTB.body?.score === 4, JSON.stringify(subTB.body));

  const bRow = await pg.query(
    `select total_score, score_round_1, score_round_2, score_tie_breaker, round2_completed_at, tie_breaker_completed_at from teams where id=$1`,
    [teamB],
  );
  const bt = bRow.rows[0];
  check("F8 tie-breaker score stored separately (score_tie_breaker==4)", bt.score_tie_breaker === 4, JSON.stringify(bt));
  check("F9 total_score NOT increased by tie-breaker (==4)", bt.total_score === 4, JSON.stringify(bt));
  check("F10 tie_breaker_completed_at set", !!bt.tie_breaker_completed_at, JSON.stringify(bt));

  const subTB2 = await team2.req("/api/quiz/submit", { json: { round: 3 } });
  check("F11 re-submit round3 idempotent (alreadyFinalized, score 4)", subTB2.status === 200 && subTB2.body?.alreadyFinalized === true && subTB2.body?.score === 4, JSON.stringify(subTB2.body));

  const startTB2 = await team2.req("/api/quiz/start", { json: { round: 3 } });
  check("F12 re-start round3 after completion -> 409", startTB2.status === 409, `got ${startTB2.status}`);

  const startTBA = await team.req("/api/quiz/start", { json: { round: 3 } });
  check("F13 non-qualified team A (round1 only) round3 -> 403", startTBA.status === 403, `got ${startTBA.status}`);

  // ---- summary ----
  console.log("\n===== E2E API RESULTS =====");
  for (const l of lines) console.log(l);
  console.log(`\nTOTAL: ${pass} passed, ${fail} failed`);

  await pg.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pg.end().catch(() => {});
  process.exit(1);
});
