# OUTPUT HUNT — VIYUGAM 2K26

A full-stack, team-based, output-prediction quiz platform with server-authoritative
scoring, timers, malpractice detection, and live admin monitoring — built with
Next.js (App Router), Drizzle ORM and PostgreSQL.

This is **not** a static mock-up. Every button performs a real, server-verified
action: team login is checked against the database, timers are computed from
server timestamps, scores are calculated in the API layer, and malpractice
strikes are recorded and enforced server-side.

## 1. Tech stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, lucide-react icons
- **Backend:** Next.js Route Handlers (`src/app/api/**`)
- **Database:** PostgreSQL via Drizzle ORM (`src/db/schema.ts`)
- **Auth:** Server-side, cookie-based sessions (httpOnly, hashed tokens in DB) —
  completely separate for participants (`oh_team_session`) and admins (`oh_admin_session`)
- **Live monitoring:** Server-Sent Events (`/api/admin/stream`)
- **Code highlighting:** `react-syntax-highlighter` (Prism, VS Code Dark+ theme)

## 2. Getting started

```bash
npm install
cp .env.example .env      # adjust DATABASE_URL if needed
npx drizzle-kit push --config=drizzle.config.json   # create tables
npx tsx src/db/seed.ts    # seed admin account, 5 sample teams, and questions
npm run build
npm run start
```

The seed script prints the admin credentials it creates:

```
username: admin
password: OutputHunt@2026
```

Sample teams `TEAM001`–`TEAM005` are created with `REGISTERED` status and are
ready to log in from `/quiz` once the organizer enables Round 1.

> Re-running `npx tsx src/db/seed.ts` is safe — it upserts the admin/teams and
> fully replaces the question bank, without touching live session data.

## 3. URLs

| Path | Purpose |
|---|---|
| `/` | Public landing page |
| `/quiz` | Participant portal (team login → rules → fullscreen → quiz → result) |
| `/admin/login` | Organizer login (separate from participant auth) |
| `/admin` | Live dashboard: teams, malpractice feed, round control, leaderboard, question bank |
| `/admin/teams/[id]` | Full detail view for one team: answers vs correct answers, security log |

## 4. Event-day admin workflow

1. Log in at `/admin/login`.
2. Go to **Round Control** and confirm question counts look right in **Questions**.
3. Click **Enable Round** for Round 1 (set duration in minutes first if needed).
4. Teams open `/quiz` on their shared laptop, enter their Team ID, accept the
   security notice, enter fullscreen, and start.
5. Watch **Teams** and the **Live Activity** feed update in real time (no refresh
   needed) as teams join, answer, trigger security events, or finish.
6. When Round 1 time is up (or all teams have submitted), open **Leaderboard →
   Round 1**, and use the ⭐ (Award) button on each team row to mark them
   `QUALIFIED_FOR_ROUND_2`.
7. Enable Round 2 the same way. Only qualified teams will be able to start it —
   this is enforced server-side, not just hidden in the UI.
8. After Round 2, open **Leaderboard → Final** for the combined ranking.
9. If there is a tie, use **Round Control → Tie-Breaker Mode** to record that a
   tie-breaker question is in effect (announce it verbally/on projector).

## 5. Security & malpractice model (read this before the event)

Browsers cannot guarantee prevention of screenshots, OS-level screen capture,
external recording devices, or a second physical device. This system does
**not** claim to. Instead it:

1. Detects everything that is realistically detectable in-browser:
   right-click, copy/cut/paste, tab switch / window blur, fullscreen exit,
   common DevTools shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U), a best-effort
   DevTools viewport heuristic, and the `PrintScreen` keydown signal.
2. Sends every signal to `POST /api/security/event`, which is the **only**
   place malpractice counts are ever incremented — never the browser.
3. Persists every event in `malpractice_events` with a timestamp, event type,
   severity, and the question the team was viewing.
4. Broadcasts the event to the admin dashboard instantly over SSE.
5. Automatically finalizes (grades) and terminates the team's session the
   moment a 3rd confirmed violation is recorded, server-side — refreshing,
   clearing local storage, or reopening the browser cannot undo this.

The admin team-detail page labels camera/print-screen style signals as
**"Screenshot/Capture Signal — Browser Detectable"**, never as absolute proof
of screenshot prevention.

## 6. Timer model

- `quiz_sessions.started_at` / `ends_at` are set once, server-side, when a team
  starts a round, using the duration configured by the admin at that moment.
- The client polls `GET /api/quiz/state` every 5 seconds and re-syncs its local
  countdown against the server's clock (`serverNow` field) — a slow client
  clock or a page refresh never resets or extends the timer.
- If the timer expires — even if the browser is closed — the next server
  request for that session (state/answer/submit, or the next security event)
  triggers `finalizeSession()`, which grades whatever was answered and marks
  the round `EXPIRED`.

## 7. Data model (see `src/db/schema.ts`)

- `admins`, `admin_sessions` — organizer accounts & login sessions
- `teams` — one row per registered team; holds scores, qualification,
  malpractice count, team status and the hashed device/session token
- `questions` — the question bank (round, language, difficulty, 4 options,
  correct option, marks, negative marks) — **never sent to the client with the
  correct answer identified**
- `quiz_sessions` — one row per team **per round**; stores the *shuffled*
  question order and per-question option mapping so the same round never
  looks identical for two teams, plus the authoritative `started_at`/`ends_at`
  and final `score`
- `quiz_answers` — one row per (session, question); what the team selected,
  whether it was correct, and marks awarded (computed at submission time)
- `malpractice_events` — full audit trail of every security signal
- `admin_actions` — audit log of every admin action (terminate, qualify,
  reset-session, settings changes, question changes)
- `event_settings` — single-row config: round enable flags, per-round
  duration, tie-breaker toggle

## 8. Key design decisions worth knowing

- **Question/option randomization is server-side and persisted.** When a team
  starts a round, the server shuffles question order and, per question, which
  option text is shown as A/B/C/D — and stores that mapping in
  `quiz_sessions.question_order`. All later answer checks resolve through that
  stored mapping, so the correct answer is never guessable from the wire
  format and is consistent across refreshes.
- **One active device session per team.** `teams.active_login_token_hash`
  stores a hash of the current session's token. A second device without a
  matching cookie is rejected with a clear "already active" error. Admins can
  clear this from the dashboard (`Reset Session` action) without touching
  quiz progress or scores.
- **Grading is idempotent and only ever server-side** (`src/lib/grading.ts`).
  It is called from `POST /api/quiz/submit`, from the timer-expiry check, and
  from the 3-strike termination path — all three converge on the exact same
  function so there is one source of truth for scores.
- **Rate limiting** is applied to login, the security-event endpoint, and
  answer submission to blunt scripted abuse (`src/lib/rate-limit.ts`).

## 9. Manual test checklist

All of the following were exercised against a running instance during
development:

- Unregistered Team ID → `"Team not registered."`
- Registered team → successful login; a second device without the session
  cookie is rejected with `"already has an active session"`.
- Starting Round 1 creates a session with shuffled questions/options; the
  correct answer is never present in the API response.
- Refreshing mid-quiz restores saved answers and the exact same countdown
  (server-computed), not a reset timer.
- Right-click / copy / cut / paste / tab-switch / fullscreen-exit / DevTools
  shortcuts each POST to `/api/security/event` and increment
  `malpractice_count` server-side.
- 3 confirmed violations flips the team to `TERMINATED`, grades whatever was
  answered, and blocks all further quiz/security calls immediately.
- A terminated team cannot start a new session, even after clearing cookies —
  the block is keyed off the team row in the database, not the browser.
- Round 1 score matches a hand-checked answer key (verified 20/20 in testing).
- An unqualified team gets `"Round 2 access denied"` even when POSTing the
  API route directly.
- A qualified team can only start Round 2 once the admin has also enabled it.
- The admin dashboard's Teams table and Live Activity feed update via SSE
  without a manual page refresh when a team logs in, starts, answers,
  triggers a security event, or submits.
- Final leaderboard sums Round 1 + Round 2 correctly and ranks ties equally.
