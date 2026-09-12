"use client";

import { useMemo, useState } from "react";
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, Loader2, Sparkles } from "lucide-react";

type Props = {
  onClose: () => void;
  onImported: () => void;
};

type ParsedTeam = {
  teamCode?: string;
  teamName: string;
  member1?: string;
  member2?: string;
  member3?: string;
  member4?: string;
  collegeDept?: string;
};

function parseDelimitedText(text: string): string[][] {
  const lines: string[][] = [];
  const trimmed = text.trim();
  if (!trimmed) return lines;

  const firstLine = trimmed.split(/\r?\n/)[0] || "";
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";

  let currentRow: string[] = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const nextChar = trimmed[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentVal.trim());
      if (currentRow.some((c) => c.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

function findMatchingHeader(headers: string[], patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const found = headers.find((h) => pattern.test(h.trim().toLowerCase()));
    if (found) return found;
  }
  return "";
}

export default function ImportTeamsModal({ onClose, onImported }: Props) {
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  // Column mappings
  const [mapping, setMapping] = useState({
    teamCode: "",
    teamName: "",
    collegeDept: "",
    member1: "",
    member2: "",
    member3: "",
    member4: "",
  });

  const [idPrefix, setIdPrefix] = useState("TEAM");
  const [autoGenerateIds, setAutoGenerateIds] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const [step, setStep] = useState<"input" | "preview">("input");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ count: number; skippedCount: number } | null>(null);

  // Parse raw text into rows & headers
  const { headers, rows } = useMemo(() => {
    if (!rawText.trim()) return { headers: [], rows: [] };
    const matrix = parseDelimitedText(rawText);
    if (matrix.length === 0) return { headers: [], rows: [] };
    const [headerRow, ...dataRows] = matrix;
    return {
      headers: headerRow.map((h) => h.trim()),
      rows: dataRows,
    };
  }, [rawText]);

  // Handle file selection
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content || "");
      autoDetectMappings(content || "");
    };
    reader.readAsText(file);
  }

  // Handle direct paste
  function handlePasteChange(text: string) {
    setRawText(text);
    autoDetectMappings(text);
  }

  // Auto-detect columns from parsed headers
  function autoDetectMappings(text: string) {
    const matrix = parseDelimitedText(text);
    if (matrix.length === 0) return;
    const h = matrix[0].map((x) => x.trim());

    const detectedCode = findMatchingHeader(h, [
      /^team\s*(id|code|no|number)$/i,
      /^team_?(id|code)$/i,
      /roll\s*no/i,
      /^id$/i,
      /^code$/i,
    ]);

    const detectedName = findMatchingHeader(h, [
      /^team\s*name$/i,
      /name\s*of\s*(the\s*)?team/i,
      /^team$/i,
      /^group\s*name$/i,
      /team/i,
    ]);

    const detectedCollege = findMatchingHeader(h, [
      /college(\s*\/?\s*department)?/i,
      /department/i,
      /^dept$/i,
      /institution/i,
      /branch/i,
    ]);

    const detectedM1 = findMatchingHeader(h, [
      /(team\s*)?leader(\s*name)?/i,
      /member\s*1(\s*name)?/i,
      /participant\s*1/i,
      /^student\s*1$/i,
      /^name\s*1$/i,
      /leader/i,
    ]);

    const detectedM2 = findMatchingHeader(h, [
      /member\s*2(\s*name)?/i,
      /participant\s*2/i,
      /^student\s*2$/i,
      /^name\s*2$/i,
    ]);

    const detectedM3 = findMatchingHeader(h, [
      /member\s*3(\s*name)?/i,
      /participant\s*3/i,
      /^student\s*3$/i,
      /^name\s*3$/i,
    ]);

    const detectedM4 = findMatchingHeader(h, [
      /member\s*4(\s*name)?/i,
      /participant\s*4/i,
      /^student\s*4$/i,
      /^name\s*4$/i,
    ]);

    setMapping({
      teamCode: detectedCode,
      teamName: detectedName || (h.length > 0 ? h[0] : ""),
      collegeDept: detectedCollege,
      member1: detectedM1,
      member2: detectedM2,
      member3: detectedM3,
      member4: detectedM4,
    });

    if (!detectedCode) {
      setAutoGenerateIds(true);
    }
  }

  // Produce list of parsed teams based on current mappings
  const parsedTeams = useMemo(() => {
    if (rows.length === 0 || !mapping.teamName) return [];

    const getIdx = (colName: string) => (colName ? headers.indexOf(colName) : -1);
    const codeIdx = getIdx(mapping.teamCode);
    const nameIdx = getIdx(mapping.teamName);
    const collegeIdx = getIdx(mapping.collegeDept);
    const m1Idx = getIdx(mapping.member1);
    const m2Idx = getIdx(mapping.member2);
    const m3Idx = getIdx(mapping.member3);
    const m4Idx = getIdx(mapping.member4);

    const result: ParsedTeam[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const teamName = nameIdx >= 0 ? (row[nameIdx] || "").trim() : "";
      if (!teamName) continue;

      let code = codeIdx >= 0 ? (row[codeIdx] || "").trim().toUpperCase() : "";
      if (!code && autoGenerateIds) {
        code = `${idPrefix}${String(i + 1).padStart(3, "0")}`;
      }

      let m1 = m1Idx >= 0 ? row[m1Idx]?.trim() : "";
      let m2 = m2Idx >= 0 ? row[m2Idx]?.trim() : "";
      let m3 = m3Idx >= 0 ? row[m3Idx]?.trim() : "";
      let m4 = m4Idx >= 0 ? row[m4Idx]?.trim() : "";

      // Fallback: If only member1 was mapped and it contains commas, split into members
      if (m1 && !m2 && !m3 && !m4 && m1.includes(",")) {
        const parts = m1.split(",").map((s) => s.trim()).filter(Boolean);
        m1 = parts[0] || "";
        m2 = parts[1] || "";
        m3 = parts[2] || "";
        m4 = parts[3] || "";
      }

      result.push({
        teamCode: code,
        teamName,
        collegeDept: collegeIdx >= 0 ? row[collegeIdx]?.trim() : "",
        member1: m1,
        member2: m2,
        member3: m3,
        member4: m4,
      });
    }

    return result;
  }, [rows, headers, mapping, autoGenerateIds, idPrefix]);

  // Execute import request
  async function handleImport() {
    if (parsedTeams.length === 0) return;
    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/teams/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teams: parsedTeams,
          autoGenerateIds,
          idPrefix,
          skipDuplicates,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to import teams.");
        return;
      }

      setSuccessResult({
        count: data.count,
        skippedCount: data.skippedCount,
      });
      onImported();
    } catch {
      setError("Network error occurred during import.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Import Teams from Google Form / CSV</h3>
              <p className="text-xs text-slate-400">Upload responses spreadsheet or paste rows to register all teams at once.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {successResult ? (
            <div className="my-8 flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h4 className="mt-4 text-xl font-bold text-white">Import Successful!</h4>
              <p className="mt-1 text-sm text-slate-300">
                Successfully registered <span className="font-semibold text-emerald-400">{successResult.count}</span> teams.
              </p>
              {successResult.skippedCount > 0 && (
                <p className="mt-1 text-xs text-amber-400">
                  ({successResult.skippedCount} duplicates skipped)
                </p>
              )}
              <button
                onClick={onClose}
                className="mt-6 rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400"
              >
                Done &amp; View Teams
              </button>
            </div>
          ) : step === "input" ? (
            <div className="space-y-5">
              {/* Tab Selector: Upload vs Paste */}
              <div className="flex gap-2 border-b border-slate-800 pb-3">
                <button
                  onClick={() => setActiveTab("upload")}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    activeTab === "upload"
                      ? "bg-sky-500 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <Upload className="h-4 w-4" /> Upload CSV File
                </button>
                <button
                  onClick={() => setActiveTab("paste")}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    activeTab === "paste"
                      ? "bg-sky-500 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Paste Google Sheets Data
                </button>
              </div>

              {activeTab === "upload" ? (
                <div>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-8 transition hover:border-sky-500/60 hover:bg-slate-950">
                    <Upload className="h-10 w-10 text-sky-400" />
                    <span className="mt-3 text-sm font-semibold text-slate-200">
                      {fileName ? fileName : "Choose a Google Form .csv or .tsv file"}
                    </span>
                    <span className="mt-1 text-xs text-slate-500">
                      Export your Google Form responses as CSV and drop it here.
                    </span>
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div>
                  <textarea
                    rows={7}
                    placeholder="Copy all columns and rows from Google Sheets (including headers) and paste here..."
                    value={rawText}
                    onChange={(e) => handlePasteChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Tip: Include header row with Team Name, College, and Member Names.</p>
                </div>
              )}

              {/* Column Mapping Section (appears once headers are recognized) */}
              {headers.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-sky-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Detected Columns ({rows.length} rows found)
                      </h4>
                    </div>
                    <span className="text-[11px] text-emerald-400">
                      Auto-matched headers from your form
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {/* Team Name */}
                    <div>
                      <label className="text-[11px] font-medium text-slate-400">Team Name *</label>
                      <select
                        value={mapping.teamName}
                        onChange={(e) => setMapping((m) => ({ ...m, teamName: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500"
                      >
                        <option value="">-- Select Column --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Team Code / ID */}
                    <div>
                      <label className="text-[11px] font-medium text-slate-400">Team Code / ID (Optional)</label>
                      <select
                        value={mapping.teamCode}
                        onChange={(e) => setMapping((m) => ({ ...m, teamCode: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500"
                      >
                        <option value="">-- Auto-generate if omitted --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* College / Dept */}
                    <div>
                      <label className="text-[11px] font-medium text-slate-400">College / Department</label>
                      <select
                        value={mapping.collegeDept}
                        onChange={(e) => setMapping((m) => ({ ...m, collegeDept: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500"
                      >
                        <option value="">-- None --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Member 1 */}
                    <div>
                      <label className="text-[11px] font-medium text-slate-400">Leader / Member 1</label>
                      <select
                        value={mapping.member1}
                        onChange={(e) => setMapping((m) => ({ ...m, member1: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500"
                      >
                        <option value="">-- None --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Member 2 */}
                    <div>
                      <label className="text-[11px] font-medium text-slate-400">Member 2</label>
                      <select
                        value={mapping.member2}
                        onChange={(e) => setMapping((m) => ({ ...m, member2: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500"
                      >
                        <option value="">-- None --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Member 3 */}
                    <div>
                      <label className="text-[11px] font-medium text-slate-400">Member 3</label>
                      <select
                        value={mapping.member3}
                        onChange={(e) => setMapping((m) => ({ ...m, member3: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500"
                      >
                        <option value="">-- None --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Member 4 */}
                    <div>
                      <label className="text-[11px] font-medium text-slate-400">Member 4</label>
                      <select
                        value={mapping.member4}
                        onChange={(e) => setMapping((m) => ({ ...m, member4: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500"
                      >
                        <option value="">-- None --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ID Generation Options */}
                  <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-800 pt-3 text-xs text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoGenerateIds}
                        onChange={(e) => setAutoGenerateIds(e.target.checked)}
                        className="rounded border-slate-700 text-sky-500"
                      />
                      <span>Auto-generate missing Team IDs (e.g. {idPrefix}001, {idPrefix}002)</span>
                    </label>

                    {autoGenerateIds && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Prefix:</span>
                        <input
                          type="text"
                          value={idPrefix}
                          onChange={(e) => setIdPrefix(e.target.value.toUpperCase())}
                          className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-center font-mono text-xs uppercase text-white"
                        />
                      </div>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="rounded border-slate-700 text-sky-500"
                      />
                      <span>Skip duplicate Team IDs</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Preview Step */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Previewing {parsedTeams.length} Teams</h4>
                  <p className="text-xs text-slate-400">Verify the parsed teams before creating them in the database.</p>
                </div>
                <button
                  onClick={() => setStep("input")}
                  className="text-xs text-sky-400 hover:underline"
                >
                  ← Back to Mapping
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-slate-800 bg-slate-900 text-slate-400">
                    <tr>
                      <th className="py-2.5 pl-4 pr-2">#</th>
                      <th className="py-2.5 px-3">Team ID</th>
                      <th className="py-2.5 px-3">Team Name</th>
                      <th className="py-2.5 px-3">Members</th>
                      <th className="py-2.5 pr-4 pl-3">College / Dept</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {parsedTeams.map((t, idx) => {
                      const members = [t.member1, t.member2, t.member3, t.member4].filter(Boolean);
                      return (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="py-2.5 pl-4 pr-2 text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-sky-400">{t.teamCode}</td>
                          <td className="py-2.5 px-3 font-semibold text-white">{t.teamName}</td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {members.length > 0 ? (
                              <span>{members.join(", ")} ({members.length})</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 pl-3 text-slate-400">{t.collegeDept || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        {!successResult && (
          <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3.5">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>

            {step === "input" ? (
              <button
                onClick={() => setStep("preview")}
                disabled={parsedTeams.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-5 py-2 text-xs font-bold text-slate-950 transition hover:bg-sky-400 disabled:opacity-40"
              >
                Preview {parsedTeams.length} Teams <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={handleImport}
                disabled={importing || parsedTeams.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-6 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {importing ? "Importing..." : `Import All ${parsedTeams.length} Teams`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
