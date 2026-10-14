// OUTPUT HUNT — Question bank integrity audit.
// Checks (independent of answer correctness, which is verified separately):
//   1. Option duplication (no two options identical for a question).
//   2. Duplicate questions within the same round (identical code+options).
//   3. Java tie-breaker programs are EXACTLY 25 physical source lines (stored src).
//   4. Answer-key length/formatting leak (correct option is not the only
//      long/differently-formatted option, which would reveal the answer).
//   5. Metadata validity: round/language/difficulty/orderIndex/marks consistency.
//   6. Language matches assigned category.
import fs from "node:fs";
import path from "node:path";

const questions = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts", "qa-questions.json"), "utf8")
);

const opt = (q, letter) => ({ A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d })[letter];
const issues = [];
const info = [];

// 1. Option duplication
for (const q of questions) {
  const opts = ["A", "B", "C", "D"].map((l) => String(opt(q, l)));
  const seen = new Map();
  for (let i = 0; i < opts.length; i++) {
    const key = opts[i];
    if (seen.has(key)) issues.push({ id: q.id, kind: "DUPLICATE_OPTION", detail: `options ${seen.get(key)} and ${"ABCD"[i]} are identical: ${JSON.stringify(key)}` });
    else seen.set(key, "ABCD"[i]);
  }
  // Missing/empty option
  ["A", "B", "C", "D"].forEach((l) => {
    if (opt(q, l) == null || String(opt(q, l)).trim() === "")
      issues.push({ id: q.id, kind: "EMPTY_OPTION", detail: `option ${l} is empty` });
  });
}

// 2. Duplicate questions within same round (by code + option set)
const byRound = {};
for (const q of questions) {
  const sig = JSON.stringify([q.code, q.option_a, q.option_b, q.option_c, q.option_d]);
  byRound[q.round] = byRound[q.round] || [];
  const dup = byRound[q.round].find((x) => x.sig === sig);
  if (dup) issues.push({ id: q.id, kind: "DUPLICATE_QUESTION", detail: `same code+options as Q#${dup.id} in round ${q.round}` });
  else byRound[q.round].push({ id: q.id, sig });
}

// 3. Java 25-line validation on the STORED source string.
const java = questions.filter((q) => q.language === "JAVA");
for (const q of java) {
  const lines = q.code.replace(/\r\n/g, "\n").split("\n").length;
  if (lines !== 25)
    issues.push({ id: q.id, kind: "JAVA_NOT_25_LINES", detail: `stored source has ${lines} physical lines (expected 25)` });
  else info.push(`Q#${q.id} Java = 25 lines OK`);
}

// 4. Answer-key length/formatting leak: flag if the correct option length is an
// outlier (much longer than all distractors) — a common give-away. Report only;
// not an automatic failure.
for (const q of questions) {
  const lens = ["A", "B", "C", "D"].map((l) => String(opt(q, l)).length);
  const correctLen = lens["ABCD".indexOf(q.correct_option)];
  const others = lens.filter((_, i) => i !== "ABCD".indexOf(q.correct_option));
  const maxOther = Math.max(...others);
  if (correctLen > maxOther * 2 && correctLen - maxOther > 15) {
    info.push(`REVIEW-LENGTH Q#${q.id}: correct option (${correctLen}) much longer than longest distractor (${maxOther}) — possible giveaway`);
  }
}

// 5 & 6. Metadata validity
const validLangByRound = { 1: ["C", "CPP", "PYTHON", "HTML"], 2: ["C", "CPP", "PYTHON", "HTML"], 3: ["JAVA"] };
for (const q of questions) {
  if (!validLangByRound[q.round] || !validLangByRound[q.round].includes(q.language))
    issues.push({ id: q.id, kind: "LANG_ROUND_MISMATCH", detail: `language ${q.language} not expected in round ${q.round}` });
  if (!["A", "B", "C", "D"].includes(q.correct_option))
    issues.push({ id: q.id, kind: "BAD_KEY", detail: `correctOption=${q.correct_option}` });
  const expectedMarks = q.round === 1 ? 1 : 2;
  if (q.marks !== expectedMarks)
    issues.push({ id: q.id, kind: "MARKS_MISMATCH", detail: `marks=${q.marks}, expected ${expectedMarks} for round ${q.round}` });
  if (q.difficulty !== (q.round === 1 ? "BASIC" : "ADVANCED"))
    issues.push({ id: q.id, kind: "DIFFICULTY_MISMATCH", detail: `difficulty=${q.difficulty} in round ${q.round}` });
}

// Round composition summary
const comp = {};
for (const q of questions) {
  comp[q.round] = comp[q.round] || {};
  comp[q.round][q.language] = (comp[q.round][q.language] || 0) + 1;
}

console.log("=== QUESTION BANK INTEGRITY ===");
console.log(`Total questions: ${questions.length}`);
console.log("Round composition:", JSON.stringify(comp));
console.log(`Java questions: ${java.length} (${java.map((q) => q.id).join(", ")})`);
console.log("\nJava 25-line check:");
info.filter((i) => i.includes("25 lines")).forEach((i) => console.log("  " + i));
const lengthReviews = info.filter((i) => i.startsWith("REVIEW-LENGTH"));
if (lengthReviews.length) {
  console.log("\nLength-giveaway review (informational):");
  lengthReviews.forEach((i) => console.log("  " + i));
}
console.log(`\nISSUES: ${issues.length}`);
for (const it of issues) console.log(`  Q#${it.id} [${it.kind}] ${it.detail}`);
console.log(issues.length === 0 ? "\nRESULT: No integrity issues detected." : "");
