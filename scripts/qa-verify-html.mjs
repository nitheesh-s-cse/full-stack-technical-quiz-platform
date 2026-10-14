// OUTPUT HUNT — HTML question DOM verification harness.
// Renders each stored HTML snippet in jsdom and compares the rendered VISIBLE
// text (textContent with HTML whitespace collapsed, per CSS rules) against the
// stored options + answer key. Also answers colspan/structural questions.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const questions = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts", "qa-questions.json"), "utf8")
).filter((q) => q.language === "HTML");

const optText = (q, letter) =>
  ({ A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d })[letter];

// Collapse runs of whitespace to a single space and trim, matching how a
// browser lays out inline text content.
function collapse(s) {
  return s.replace(/\s+/g, " ").trim();
}

let pass = 0;
const failures = [];
const review = [];

for (const q of questions) {
  // Q18: ordered list with start="3" — answer is the marker numbers.
  if (q.id === 18) {
    const dom = new JSDOM(q.code);
    const ol = dom.window.document.querySelector("ol");
    const start = parseInt(ol.getAttribute("start") || "1", 10);
    const count = ol.querySelectorAll("li").length;
    const numbers = Array.from({ length: count }, (_, i) => start + i).join(", ");
    const stored = q.correct_option;
    const storedText = optText(q, stored);
    if (collapse(numbers) === collapse(storedText)) pass++;
    else
      failures.push({ id: q.id, kind: "OL_START_MISMATCH", computed: numbers, storedKey: stored, storedText });
    continue;
  }

  // Q19: input value + disabled state.
  if (q.id === 19) {
    const dom = new JSDOM(q.code);
    const input = dom.window.document.querySelector("input");
    const shown = input.getAttribute("value");
    const editable = !input.hasAttribute("disabled") && !input.hasAttribute("readonly");
    const computed = `Shows "${shown}"; field is ${editable ? "editable" : "not editable"}`;
    const stored = q.correct_option;
    const storedText = optText(q, stored);
    if (collapse(computed) === collapse(storedText)) pass++;
    else
      failures.push({ id: q.id, kind: "INPUT_MISMATCH", computed, storedKey: stored, storedText });
    continue;
  }

  // Q30: needs script execution + document.write. Run with runScripts.
  if (q.id === 30) {
    const dom = new JSDOM(q.code, { runScripts: "dangerously" });
    const written = dom.window.document.body.textContent;
    // document.write appends to the body; extract what the script wrote (after
    // the original div content, which the script replaced). The script sets
    // box.innerHTML then writes box.textContent = "Original Content".
    const stored = q.correct_option;
    const storedText = optText(q, stored);
    // The visible written value is the box textContent after the script runs.
    const m = written.match(/Original\s*Content/);
    const computed = m ? "Original Content" : written.replace(/\s+/g, " ").trim();
    if (collapse(computed) === collapse(storedText)) pass++;
    else
      failures.push({ id: q.id, kind: "SCRIPT_MISMATCH", computed, storedKey: stored, storedText, raw: written.slice(0, 200) });
    continue;
  }

  const dom = new JSDOM(q.code);
  const doc = dom.window.document;

  // For Q29 (colspan/structural), we validate the DOM structure directly.
  if (q.id === 29) {
    const headerRow = doc.querySelector("tr");
    const headerCells = headerRow ? headerRow.querySelectorAll("th") : [];
    const headerSpan = Array.from(headerCells).reduce(
      (acc, th) => acc + (parseInt(th.getAttribute("colspan") || "1", 10) || 1),
      0
    );
    // "Pen row" is the row whose first td text is "Pen".
    const rows = Array.from(doc.querySelectorAll("tr"));
    const penRow = rows.find((tr) => {
      const first = tr.querySelector("td");
      return first && first.textContent.trim() === "Pen";
    });
    const penCells = penRow ? penRow.querySelectorAll("td").length : 0;
    const computed = `Header spans ${headerSpan} columns; Pen row has ${penCells} cells`;
    const stored = q.correct_option;
    const storedText = optText(q, stored);
    const match = collapse(computed) === collapse(storedText);
    if (match) pass++;
    else
      failures.push({
        id: q.id,
        kind: "STRUCT_MISMATCH",
        computed,
        storedKey: stored,
        storedText,
      });
    continue;
  }

  // Visible text = textContent collapsed (entities resolved, comments removed,
  // tags stripped, whitespace collapsed). jsdom's textContent already excludes
  // comment nodes and resolves entities like &amp; -> &.
  const visible = collapse(doc.body.textContent);

  // Compare the RENDERED (collapsed) text against each option's RAW text.
  // We deliberately do NOT collapse the option: distractors that differ only
  // by un-collapsed whitespace (e.g. "Hello    World") must NOT match the
  // canonical rendered "Hello World". Only the correctly-written option matches.
  const matched = [];
  for (const letter of ["A", "B", "C", "D"]) {
    const text = optText(q, letter);
    if (text == null) continue;
    if (visible === String(text).trim()) matched.push(letter);
  }

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
  else failures.push({ id: q.id, kind: status, storedKey: stored, matchedByOutput: matched, rendered: visible });
}

console.log("=== HTML DOM VERIFICATION ===");
console.log(`Total HTML questions: ${questions.length}`);
console.log(`PASS: ${pass}`);
console.log(`FAILURES: ${failures.length}`);
console.log("\n--- DETAIL ---");
for (const q of questions) {
  const dom = new JSDOM(q.code);
  console.log(`Q#${q.id} key=${q.correct_option} rendered="${collapse(dom.window.document.body.textContent)}"`);
}
for (const f of failures) {
  console.log(`\nFAIL Q#${f.id} [${f.kind}] storedKey=${f.storedKey} matched=${JSON.stringify(f.matchedByOutput)} computed/rendered=${JSON.stringify(f.computed || f.rendered)}`);
}
