import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// ADMINS
// ---------------------------------------------------------------------------
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 128 }).notNull().default("Administrator"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  usernameIdx: uniqueIndex("admins_username_idx").on(t.username),
}));

export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => ({
  tokenIdx: uniqueIndex("admin_sessions_token_idx").on(t.tokenHash),
}));

// ---------------------------------------------------------------------------
// TEAMS
// ---------------------------------------------------------------------------
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  teamCode: varchar("team_code", { length: 32 }).notNull(),
  teamName: varchar("team_name", { length: 128 }).notNull(),
  member1Name: varchar("member_1_name", { length: 128 }),
  member2Name: varchar("member_2_name", { length: 128 }),
  member3Name: varchar("member_3_name", { length: 128 }),
  member4Name: varchar("member_4_name", { length: 128 }),
  collegeDept: varchar("college_dept", { length: 200 }),
  registrationStatus: varchar("registration_status", { length: 32 }).notNull().default("REGISTERED"),
  qualifiedForRound2: boolean("qualified_for_round_2").notNull().default(false),
  currentRound: integer("current_round").notNull().default(1),
  quizStartedAt: timestamp("quiz_started_at", { withTimezone: true }),
  quizCompletedAt: timestamp("quiz_completed_at", { withTimezone: true }),
  round2StartedAt: timestamp("round2_started_at", { withTimezone: true }),
  round2CompletedAt: timestamp("round2_completed_at", { withTimezone: true }),
  scoreRound1: integer("score_round_1").notNull().default(0),
  scoreRound2: integer("score_round_2").notNull().default(0),
  totalScore: integer("total_score").notNull().default(0),
  malpracticeCount: integer("malpractice_count").notNull().default(0),
  teamStatus: varchar("team_status", { length: 32 }).notNull().default("REGISTERED"),
  activeLoginTokenHash: varchar("active_login_token_hash", { length: 128 }),
  deviceInfo: text("device_info"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  terminationReason: text("termination_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  teamCodeIdx: uniqueIndex("teams_team_code_idx").on(t.teamCode),
}));

// ---------------------------------------------------------------------------
// QUESTIONS
// ---------------------------------------------------------------------------
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  round: integer("round").notNull(),
  language: varchar("language", { length: 16 }).notNull(),
  difficulty: varchar("difficulty", { length: 16 }).notNull(),
  code: text("code").notNull(),
  questionText: text("question_text").notNull().default("What will be the output of this program?"),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctOption: varchar("correct_option", { length: 1 }).notNull(),
  explanation: text("explanation"),
  marks: integer("marks").notNull().default(1),
  negativeMarks: integer("negative_marks").notNull().default(0),
  orderIndex: integer("order_index").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  roundIdx: index("questions_round_idx").on(t.round),
}));

// ---------------------------------------------------------------------------
// QUIZ SESSIONS (per team, per round)
// ---------------------------------------------------------------------------
export const quizSessions = pgTable("quiz_sessions", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  round: integer("round").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"), // ACTIVE | COMPLETED | TERMINATED | EXPIRED
  questionOrder: jsonb("question_order").notNull(), // [{questionId, options:[{label:'A',key:'c'}, ...]}]
  durationMinutes: integer("duration_minutes").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  score: integer("score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  teamRoundIdx: uniqueIndex("quiz_sessions_team_round_idx").on(t.teamId, t.round),
}));

// ---------------------------------------------------------------------------
// QUIZ ANSWERS
// ---------------------------------------------------------------------------
export const quizAnswers = pgTable("quiz_answers", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => quizSessions.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  round: integer("round").notNull(),
  selectedLabel: varchar("selected_label", { length: 1 }), // A/B/C/D as displayed to the team
  isCorrect: boolean("is_correct"),
  marksAwarded: integer("marks_awarded").notNull().default(0),
  answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  sessionQuestionIdx: uniqueIndex("quiz_answers_session_question_idx").on(t.sessionId, t.questionId),
}));

// ---------------------------------------------------------------------------
// MALPRACTICE EVENTS
// ---------------------------------------------------------------------------
export const malpracticeEvents = pgTable("malpractice_events", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => quizSessions.id, { onDelete: "set null" }),
  round: integer("round").notNull().default(1),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  questionId: integer("question_id").references(() => questions.id, { onDelete: "set null" }),
  metadata: jsonb("metadata"),
  severity: varchar("severity", { length: 16 }).notNull().default("MEDIUM"),
  adminAcknowledged: boolean("admin_acknowledged").notNull().default(false),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  teamIdx: index("malpractice_events_team_idx").on(t.teamId),
}));

// ---------------------------------------------------------------------------
// ADMIN ACTIONS (audit log)
// ---------------------------------------------------------------------------
export const adminActions = pgTable("admin_actions", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => admins.id, { onDelete: "set null" }),
  actionType: varchar("action_type", { length: 64 }).notNull(),
  targetTeamId: integer("target_team_id").references(() => teams.id, { onDelete: "set null" }),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// EVENT SETTINGS (single row config)
// ---------------------------------------------------------------------------
export const eventSettings = pgTable("event_settings", {
  id: integer("id").primaryKey().default(1),
  round1Enabled: boolean("round1_enabled").notNull().default(false),
  round1DurationMinutes: integer("round1_duration_minutes").notNull().default(30),
  round2Enabled: boolean("round2_enabled").notNull().default(false),
  round2DurationMinutes: integer("round2_duration_minutes").notNull().default(20),
  tieBreakerEnabled: boolean("tie_breaker_enabled").notNull().default(false),
  tieBreakerNote: text("tie_breaker_note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
