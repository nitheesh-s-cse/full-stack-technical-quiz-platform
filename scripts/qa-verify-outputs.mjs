// OUTPUT HUNT — Question bank output verification harness.
// Compiles/executes each stored program and compares the REAL output against
// every stored option + the stored answer key. This does not trust the seed key.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const VCVARS =
  'C:\\Program Files (x86)\\Microsoft Visual Studio\\18\\BuildTools\\VC\\Auxiliary\\Build\\vcvars64.bat';

const questions = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts", "qa-questions.json"), "utf8")
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "oh-qa-"));
const optText = (q, letter) =>
  ({ A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d })[letter];

function runCmd(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024,
    ...opts,
  });
}

function compileAndRunC(code, isCpp, id) {
  const ext = isCpp ? "cpp" : "c";
  const src = path.join(tmp, `q${id}.${ext}`);
  const exe = path.join(tmp, `q${id}.exe`);
  const bat = path.join(tmp, `build${id}.bat`);
  fs.writeFileSync(src, code, "utf8");
  const std = isCpp ? "/EHsc /TP" : "/TC";
  // Write a batch file to avoid cmd.exe quoting issues with the space/parens
  // in the BuildTools path. cl compiles + links in one step.
  fs.writeFileSync(
    bat,
    `@echo off\r\ncall "${VCVARS}" >nul\r\ncl /nologo ${std} /Fe:"${exe}" "${src}"\r\n`,
    "utf8"
  );
  runCmd("cmd.exe", ["/d", "/c", bat], { stdio: ["ignore", "ignore", "pipe"] });
  return runCmd(exe, [], { encoding: "utf8" });
}

function runJava(code, id) {
  const m = code.match(/public\s+class\s+(\w+)/);
  const cls = m ? m[1] : `Q${id}`;
  const src = path.join(tmp, `${cls}.java`);
  fs.writeFileSync(src, code, "utf8");
  runCmd("javac", ["-d", tmp, src]);
  const out = runCmd("java", ["-cp", tmp, cls], { encoding: "utf8" });
  return out;
}

function runPython(code, id) {
  const src = path.join(tmp, `q${id}.py`);
  fs.writeFileSync(src, code, "utf8");
  return runCmd("python", [src], { encoding: "utf8" });
}

// Build candidate normalizations of actual output. Windows console programs
// (cl.exe) emit CRLF line endings, so normalize \r\n -> \n first so that
// multi-line / pipe-joined comparisons match correctly.
function candidatesOf(raw) {
  const base = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const trimmed = base.replace(/\s+$/, "");
  const set = new Set();
  set.add(trimmed);
  set.add(trimmed.trim());
  set.add(trimmed.replace(/\n/g, " | ").replace(/\s+$/, ""));
  set.add(trimmed.replace(/\n/g, " | ").trim());
  set.add(trimmed.split("\n").map((l) => l.replace(/\s+$/, "")).join(" | "));
  return set;
}

// Extract the last numeric value printed anywhere in the output (handles
// "What is the final value printed for X?" questions whose options are bare
// numbers like "36"). Returns the token as a string, or null.
function lastNumericToken(raw) {
  const base = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const matches = base.match(/-?\d+(?:\.\d+)?/g);
  return matches && matches.length ? matches[matches.length - 1] : null;
}

function matchOption(q, raw) {
  const cands = candidatesOf(raw);
  const matched = [];
  for (const letter of ["A", "B", "C", "D"]) {
    const text = optText(q, letter);
    if (text == null) continue;
    for (const c of cands) {
      if (c === text || c.replace(/\s+/g, " ").trim() === String(text).replace(/\s+/g, " ").trim()) {
        matched.push(letter);
        break;
      }
    }
  }
  // "Final value" style questions: options are bare numeric tokens and the
  // question asks for the final printed value. Match the trailing number.
  if (matched.length === 0 && /final value|value printed for|final Total/i.test(q.question_text || "")) {
    const last = lastNumericToken(raw);
    if (last != null) {
      for (const letter of ["A", "B", "C", "D"]) {
        const text = optText(q, letter);
        if (text != null && String(text).trim() === last) matched.push(letter);
      }
    }
  }
  return matched;
}

let pass = 0;
const failures = [];
const notRun = [];

for (const q of questions) {
  let actual = null;
  let err = null;
  try {
    if (q.language === "C") actual = compileAndRunC(q.code, false, q.id);
    else if (q.language === "CPP") actual = compileAndRunC(q.code, true, q.id);
    else if (q.language === "JAVA") actual = runJava(q.code, q.id);
    else if (q.language === "PYTHON") actual = runPython(q.code, q.id);
    else {
      notRun.push({ id: q.id, language: q.language, reason: "HTML handled separately" });
      continue;
    }
  } catch (e) {
    err = (e.stderr ? e.stderr.toString() : e.message).slice(0, 400);
  }

  if (err) {
    failures.push({ id: q.id, lang: q.language, kind: "EXEC_ERROR", detail: err, correctOption: q.correct_option });
    continue;
  }

  const matched = matchOption(q, actual);
  const stored = q.correct_option;
  const status =
    matched.length === 1 && matched[0] === stored
      ? "PASS"
      : matched.length === 0
      ? "FAIL_NO_OPTION_MATCHES_OUTPUT"
      : matched.length > 1
      ? "AMBIGUOUS_MULTIPLE_MATCH"
      : "FAIL_KEY_MISMATCH";

  if (status === "PASS") pass++;
  else
    failures.push({
      id: q.id,
      lang: q.language,
      kind: status,
      storedKey: stored,
      storedKeyText: optText(q, stored),
      matchedByOutput: matched,
      allOptions: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
      actualOutput: actual.replace(/\r/g, "").slice(0, 300),
    });
}

console.log("=== OUTPUT VERIFICATION ===");
console.log(`Total executable questions: ${questions.filter((q) => q.language !== "HTML").length}`);
console.log(`PASS: ${pass}`);
console.log(`FAILURES: ${failures.length}`);
if (notRun.length) console.log(`NOT-RUN (HTML): ${notRun.map((n) => `#${n.id}`).join(", ")}`);
console.log("\n--- FAILURE DETAIL ---");
for (const f of failures) {
  console.log(`\nQ#${f.id} [${f.lang}] ${f.kind}`);
  if (f.storedKey) {
    console.log(`  storedKey=${f.storedKey} storedKeyText=${JSON.stringify(f.storedKeyText)} matchedByOutput=${JSON.stringify(f.matchedByOutput)}`);
    console.log(`  allOptions=${JSON.stringify(f.allOptions)}`);
  }
  console.log(`  actual=${JSON.stringify(f.actualOutput || f.detail)}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
