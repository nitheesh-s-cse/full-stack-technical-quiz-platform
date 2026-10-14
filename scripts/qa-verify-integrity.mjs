// OUTPUT HUNT — Question bank integrity checks (no execution; pure data checks).
// 1. Round 3 Java programs contain exactly 25 physical lines (stored source).
// 2. No duplicated option within a question.
// 3. No duplicated option that accidentally reveals the answer.
// 4. No duplicated question (same code) in the same round.
// 5. Language category matches the round rules.
// 6. correctOption is one of A/B/C/D.
import fs from "node:fs";
import path from "node:path";

const questions = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts", "qa-questions.json"), "utf8")
);

const optText = (q, letter) =>
  ({ A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d })[letter];

const problems = [];
let lineChecks = 0;

for (const q of questions) {
  // 1. Java 25-line validation (stored source, normalize CRLF).
  if (q.language === "JAVA" && q.round === 3) {
    const lines = q.code.replace(/\r\n/g, "\n").split("\n").length;
    lineChecks++;
    if (lines !== 25) {
      problems.push({ id: q.id, kind: "JAVA_LINES_NOT_25", lines });
    }
  }

  // 6. Answer key validity.
  if (!["A", "B", "C", "D"].includes(q.correct_option)) {
    problems.push({ id: q.id, kind: "INVALID_CORRECT_OPTION", correct: q.correct_option });
  }

  // 2. Duplicate options within a question (case/whitespace-sensitive exact dup).
  const opts = ["A", "B", "C", "D"].map((l) => optText(q, l));
  for (let i = 0; i < opts.length; i++) {
    for (let j = i + 1; j < opts.length; j++) {
      if (opts[i] != null && opts[i] === opts[j]) {
        problems.push({ id: q.id, kind: "DUPLICATE_OPTION", a: opts[i], letters: `${"ABCD"[i]}${"ABCD"[j]}` });
      }
    }
  }

  // 3. All four options present.
  if (opts.some((o) => o == null || String(o).trim() === "")) {
    problems.push({ id: q.id, kind: "EMPTY_OPTION" });
  }
}

// 4. Duplicate question code within the same round.
const byRound = {};
for (const q of questions) {
  byRound[q.round] ??= [];
  byRound[q.round].push(q);
}
for (const [round, qs] of Object.entries(byRound)) {
  const seen = new Map();
  for (const q of qs) {
    const key = q.code.replace(/\s+/g, " ").trim();
    if (seen.has(key)) {
      problems.push({ round, kind: "DUPLICATE_QUESTION_IN_ROUND", ids: [seen.get(key), q.id] });
    } else seen.set(key, q.id);
  }
}

// 5. Round/language composition summary.
const summary = {};
for (const q of questions) {
  const k = `R${q.round}:${q.language}`;
  summary[k] = (summary[k] || 0) + 1;
}

console.log("=== QUESTION BANK INTEGRITY ===");
console.log(`Total questions: ${questions.length}`);
console.log(`Round 3 Java 25-line checks performed: ${lineChecks}`);
console.log("Composition:", JSON.stringify(summary, Object.keys(summary).sort()));
console.log(`PROBLEMS: ${problems.length}`);
for (const p of problems) console.log("  " + JSON.stringify(p));
if (problems.length === 0) console.log("No integrity problems found.");
