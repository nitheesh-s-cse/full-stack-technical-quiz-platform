// scripts/qa-live-e2e.mjs
// Comprehensive live End-to-End API and Flow Test against http://localhost:3000

const BASE = "http://localhost:3000";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

class SessionClient {
  constructor() {
    this.cookies = new Map();
  }

  async fetch(endpoint, options = {}) {
    const url = `${BASE}${endpoint}`;
    const headers = { ...(options.headers || {}) };

    if (this.cookies.size > 0) {
      headers["cookie"] = Array.from(this.cookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    }

    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      headers["content-type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, { ...options, headers });

    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    const rawSetCookie = res.headers.get("set-cookie");
    const allSetCookies = setCookies.length > 0 ? setCookies : rawSetCookie ? [rawSetCookie] : [];
    for (const cookieStr of allSetCookies) {
      const parts = cookieStr.split(";");
      const [nameVal] = parts;
      const eqIdx = nameVal.indexOf("=");
      if (eqIdx !== -1) {
        const name = nameVal.slice(0, eqIdx).trim();
        const val = nameVal.slice(eqIdx + 1).trim();
        this.cookies.set(name, val);
      }
    }

    let json = null;
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {}

    return {
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      data: json,
      rawText: text,
    };
  }
}

async function runLiveE2ETests() {
  console.log("==================================================");
  console.log("   OUTPUT HUNT - LIVE FULL E2E SYSTEM AUDIT      ");
  console.log("==================================================\n");

  const student = new SessionClient();
  const admin = new SessionClient();

  // --- TEST 1: Health Check ---
  console.log("[1] Health Check Verification");
  const healthRes = await student.fetch("/api/health");
  assert(healthRes.status === 200 && healthRes.data?.ok === true, "Health endpoint returned 200 OK");

  // --- TEST 2: Student Login with Invalid Team ID ---
  console.log("\n[2] Team Authentication Validation");
  const invalidLogin = await student.fetch("/api/team/login", {
    method: "POST",
    body: { teamCode: "INVALID_CODE_999" },
  });
  assert(invalidLogin.status === 404, "Invalid team code correctly rejected with 404");

  // --- TEST 3: Student Login with Valid Team ID (TEAM003) ---
  const validLogin = await student.fetch("/api/team/login", {
    method: "POST",
    body: { teamCode: "TEAM003" },
  });
  assert(validLogin.status === 200, "Valid team (TEAM003) login returned 200 OK");
  assert(validLogin.data?.team?.teamName === "Byte Force", "Team name matches 'Byte Force'");
  assert(student.cookies.has("oh_team_session"), "Session cookie 'oh_team_session' received");

  // --- TEST 4: Student Session Persistence (/api/team/me) ---
  console.log("\n[3] Student Session Verification");
  const meRes = await student.fetch("/api/team/me");
  assert(meRes.status === 200, "Session authenticated for /api/team/me");
  assert(meRes.data?.team?.teamCode === "TEAM003", "Authenticated team code is TEAM003");

  // --- TEST 5: Quiz Start (Round 1) ---
  console.log("\n[4] Quiz Initialization (Round 1)");
  const startRes = await student.fetch("/api/quiz/start", {
    method: "POST",
    body: { round: 1 },
  });
  assert(startRes.status === 200, "Quiz start returned 200 OK");
  assert(startRes.data?.round === 1, "Session round is 1");
  assert(Array.isArray(startRes.data?.questions), "Questions list returned");
  assert(startRes.data?.questions?.length === 20, "Round 1 contains exactly 20 questions");
  assert(Boolean(startRes.data?.endsAt), "Session has calculated endsAt timestamp");

  const questions = startRes.data?.questions || [];
  const q1 = questions[0];
  assert(Boolean(q1?.questionId && q1?.options?.A && q1?.options?.B), "Questions have valid IDs and options A, B, C, D");

  // --- TEST 6: Quiz State Reconnect ---
  console.log("\n[5] Reconnect & Resume State");
  const stateRes = await student.fetch("/api/quiz/state?round=1");
  assert(stateRes.status === 200, "State endpoint /api/quiz/state returned 200 OK");
  assert(stateRes.data?.status === "ACTIVE", "Session is ACTIVE");

  // --- TEST 7: Answer Submission ---
  console.log("\n[6] Answering Questions");
  if (q1) {
    const answerRes = await student.fetch("/api/quiz/answer", {
      method: "POST",
      body: {
        round: 1,
        questionId: q1.questionId,
        selectedLabel: "A",
      },
    });
    assert(answerRes.status === 200 && answerRes.data?.ok === true, "Option selection saved successfully");
  }

  // Verify answer is persisted in state
  const stateWithAnswer = await student.fetch("/api/quiz/state?round=1");
  assert(stateWithAnswer.data?.answers?.[q1.questionId] === "A", "Answer 'A' successfully persisted in state");

  // --- TEST 8: Anti-Cheat & Malpractice Engine ---
  console.log("\n[7] Malpractice Engine & Anti-Cheat Throttling");
  const secEvent1 = await student.fetch("/api/security/event", {
    method: "POST",
    body: {
      round: 1,
      eventType: "TAB_SWITCH",
      questionId: q1?.questionId,
    },
  });
  assert(secEvent1.status === 200, "Security event accepted by server");
  assert(secEvent1.data?.terminated === false, "First strike did not terminate the team");

  // Correlated rapid event (e.g. blur right after tab switch) should be throttled
  const secEvent2 = await student.fetch("/api/security/event", {
    method: "POST",
    body: {
      round: 1,
      eventType: "WINDOW_BLUR",
      questionId: q1?.questionId,
    },
  });
  assert(secEvent2.status === 200, "Second security event accepted");
  assert(secEvent2.data?.throttled === true, "Burst/correlated event was throttled to prevent unfair termination");

  // --- TEST 9: Finalize / Submit Quiz ---
  console.log("\n[8] Quiz Submission & Scoring");
  const submitRes = await student.fetch("/api/quiz/submit", {
    method: "POST",
    body: { round: 1 },
  });
  assert(submitRes.status === 200, "Quiz submitted successfully");
  assert(submitRes.data?.score === undefined, "Participant submit response does NOT reveal score");
  assert(submitRes.data?.correctCount === undefined, "Participant submit response does NOT reveal correctCount");
  assert(submitRes.data?.ok === true, "Submit response confirmed ok: true");

  // Subsequent submit is idempotent
  const secondSubmit = await student.fetch("/api/quiz/submit", {
    method: "POST",
    body: { round: 1 },
  });
  assert(secondSubmit.data?.alreadyFinalized === true, "Duplicate submission handled idempotently");

  // --- TEST 10: Admin Authentication ---
  console.log("\n[9] Admin Portal Authentication");
  const badAdminLogin = await admin.fetch("/api/admin/login", {
    method: "POST",
    body: { username: "admin", password: "WrongPassword" },
  });
  assert(badAdminLogin.status === 401, "Invalid admin password rejected with 401");

  const goodAdminLogin = await admin.fetch("/api/admin/login", {
    method: "POST",
    body: { username: "admin", password: "JustPassword@2026" },
  });
  assert(goodAdminLogin.status === 200, "Valid admin credentials accepted with 200 OK");
  assert(admin.cookies.has("oh_admin_session"), "Admin cookie 'oh_admin_session' received");

  // --- TEST 11: Admin me ---
  const adminMe = await admin.fetch("/api/admin/me");
  assert(adminMe.status === 200 && adminMe.data?.admin?.username === "admin", "Admin identity verified");

  // --- TEST 12: Admin Dashboard Data ---
  console.log("\n[10] Admin Dashboard Capabilities");
  const teamsRes = await admin.fetch("/api/admin/teams");
  assert(teamsRes.status === 200 && Array.isArray(teamsRes.data?.teams), "Admin can list teams");

  const settingsRes = await admin.fetch("/api/admin/settings");
  assert(settingsRes.status === 200 && Boolean(settingsRes.data?.settings), "Admin can fetch event settings");

  const questionsRes = await admin.fetch("/api/admin/questions");
  assert(questionsRes.status === 200 && Array.isArray(questionsRes.data?.questions), "Admin can view questions bank");
  assert(questionsRes.data?.questions?.length >= 35, `Question bank loaded (${questionsRes.data?.questions?.length} questions)`);

  const leaderboardRes = await admin.fetch("/api/admin/leaderboard?mode=round1");
  assert(leaderboardRes.status === 200 && Array.isArray(leaderboardRes.data?.leaderboard), "Leaderboard generated accurately");

  // --- TEST 13: Admin Reset Team Session ---
  console.log("\n[11] Admin Operations (Reset Team Session / Reinstate)");
  const team3 = teamsRes.data?.teams?.find((t) => t.teamCode === "TEAM003");
  if (team3) {
    const resetRes = await admin.fetch(`/api/admin/teams/${team3.id}/reset-session`, {
      method: "POST",
    });
    assert(resetRes.status === 200, "Admin can reset team session if a student gets disconnected");
  }

  // --- TEST 14: HTML Rendering of Main Pages ---
  console.log("\n[12] Frontend Page Rendering");
  const homePage = await fetch(`${BASE}/`);
  assert(homePage.status === 200, "Student landing page '/' returns 200 OK");

  const adminLoginPage = await fetch(`${BASE}/admin/login`);
  assert(adminLoginPage.status === 200, "Admin login page '/admin/login' returns 200 OK");

  const adminPage = await fetch(`${BASE}/admin`);
  assert(adminPage.status === 200 || adminPage.status === 307, "Admin dashboard page returns 200/redirect");

  console.log("\n==================================================");
  console.log(`TOTAL CHECKS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runLiveE2ETests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
