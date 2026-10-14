// OUTPUT HUNT — Java 25-line validation on the STORED source strings.
import fs from "node:fs";
import path from "node:path";
const questions = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts", "qa-questions.json"), "utf8")
).filter((q) => q.language === "JAVA");
let ok = true;
for (const q of questions) {
  const lines = q.code.replace(/\r\n/g, "\n").split("\n").length;
  const pass = lines === 25;
  if (!pass) ok = false;
  console.log(`Q${q.id} (JAVA): ${lines} physical lines ${pass ? "OK" : "*** FAIL ***"}`);
}
console.log(ok ? "ALL 5 JAVA PROGRAMS = 25 LINES" : "JAVA LINE VALIDATION FAILED");
process.exit(ok ? 0 : 1);
