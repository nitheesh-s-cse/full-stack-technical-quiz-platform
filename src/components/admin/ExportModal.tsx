"use client";

import { useState } from "react";
import {
  X,
  FileSpreadsheet,
  Download,
  Trophy,
  Users,
  ShieldAlert,
  HelpCircle,
  Clock,
  Sparkles,
  CheckCircle2,
  Loader2,
} from "lucide-react";

type ExportSheetKey =
  | "all"
  | "master"
  | "roster"
  | "round1"
  | "round2"
  | "tiebreaker"
  | "malpractice"
  | "questions";

export default function ExportModal({ onClose }: { onClose: () => void }) {
  const [downloadingSheet, setDownloadingSheet] = useState<ExportSheetKey | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleDownload(sheet: ExportSheetKey) {
    setDownloadingSheet(sheet);
    setErrorMsg(null);
    setDownloadSuccess(null);

    try {
      const url = `/api/admin/export${sheet === "all" ? "" : `?sheet=${sheet}`}`;
      const res = await fetch(url);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed to download (HTTP ${res.status})`);
      }

      // Extract filename from Content-Disposition if present
      let filename = `Quiz_Export_${sheet}.xlsx`;
      const disposition = res.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setDownloadSuccess(filename);
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err: unknown) {
      console.error("Export error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to download Excel file");
    } finally {
      setDownloadingSheet(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Export to Excel (.xlsx)
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Live Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Download complete participant rosters, round-wise scores, timings, and malpractice logs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success or Error alert banner */}
        {downloadSuccess && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Successfully exported <strong>{downloadSuccess}</strong>! Check your downloads folder.
            </span>
          </div>
        )}
        {errorMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {/* Main Hero Card: Full Multi-Sheet Workbook */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 p-5 shadow-lg">
            <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
              <Sparkles className="h-3 w-3" /> Recommended
            </div>

            <div className="max-w-xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Full Competition Workbook (.xlsx)
              </h3>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Generates a single comprehensive Excel file packed with <strong>7 specialized sheets</strong>. Includes
                overall rankings, individual participant names, detailed scores for all rounds, timings, accuracy rates,
                and malpractice event logs.
              </p>

              {/* Sheet tags */}
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded-md bg-slate-800/90 border border-slate-700 px-2 py-0.5 text-slate-300">
                  📊 Master Leaderboard
                </span>
                <span className="rounded-md bg-slate-800/90 border border-slate-700 px-2 py-0.5 text-slate-300">
                  👥 Participant Roster
                </span>
                <span className="rounded-md bg-slate-800/90 border border-slate-700 px-2 py-0.5 text-slate-300">
                  🥇 Round 1 (Prelims)
                </span>
                <span className="rounded-md bg-slate-800/90 border border-slate-700 px-2 py-0.5 text-slate-300">
                  🥈 Round 2 (Finals)
                </span>
                <span className="rounded-md bg-slate-800/90 border border-slate-700 px-2 py-0.5 text-slate-300">
                  ⚡ Tie-Breaker
                </span>
                <span className="rounded-md bg-slate-800/90 border border-slate-700 px-2 py-0.5 text-slate-300">
                  🛡️ Malpractice Log
                </span>
                <span className="rounded-md bg-slate-800/90 border border-slate-700 px-2 py-0.5 text-slate-300">
                  🧠 Question Analytics
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-emerald-500/20 pt-4">
              <span className="text-xs text-emerald-400 font-medium">
                Auto-formatted columns • Ready for reporting & certificates
              </span>
              <button
                onClick={() => handleDownload("all")}
                disabled={downloadingSheet !== null}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {downloadingSheet === "all" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating Workbook...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" /> Download Complete Workbook (.xlsx)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Individual Sheet Exports */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Or Download Individual Reports
            </h4>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Leaderboard only */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4 hover:border-slate-700">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Trophy className="h-4 w-4 text-amber-400" /> Master Leaderboard Only
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Rankings, total scores, Round 1 & Round 2 breakdown, team status, and qualification flags.
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-end">
                  <button
                    onClick={() => handleDownload("master")}
                    disabled={downloadingSheet !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                  >
                    {downloadingSheet === "master" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Export Leaderboard (.xlsx)
                  </button>
                </div>
              </div>

              {/* Participants Roster */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4 hover:border-slate-700">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Users className="h-4 w-4 text-sky-400" /> Participants Roster
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Individual row for each participant (Member 1-4) with Team ID, college, rank, and score.
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-end">
                  <button
                    onClick={() => handleDownload("roster")}
                    disabled={downloadingSheet !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                  >
                    {downloadingSheet === "roster" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Export Roster (.xlsx)
                  </button>
                </div>
              </div>

              {/* Round 1 Scores */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4 hover:border-slate-700">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Clock className="h-4 w-4 text-emerald-400" /> Round 1 (Prelims) Scores
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Questions attempted, correct answers, accuracy %, time taken, and Round 2 qualification.
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-end">
                  <button
                    onClick={() => handleDownload("round1")}
                    disabled={downloadingSheet !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                  >
                    {downloadingSheet === "round1" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Export Round 1 (.xlsx)
                  </button>
                </div>
              </div>

              {/* Round 2 Scores */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4 hover:border-slate-700">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Trophy className="h-4 w-4 text-purple-400" /> Round 2 (Finals) Scores
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Advanced round scores, questions attempted, correct answers, time taken, and ranks.
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-end">
                  <button
                    onClick={() => handleDownload("round2")}
                    disabled={downloadingSheet !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                  >
                    {downloadingSheet === "round2" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Export Round 2 (.xlsx)
                  </button>
                </div>
              </div>

              {/* Malpractice Log */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4 hover:border-slate-700">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <ShieldAlert className="h-4 w-4 text-red-400" /> Malpractice & Security Log
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Tab switches, DevTools detections, fullscreen exits, timestamps, and severity levels.
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-end">
                  <button
                    onClick={() => handleDownload("malpractice")}
                    disabled={downloadingSheet !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                  >
                    {downloadingSheet === "malpractice" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Export Malpractice Log (.xlsx)
                  </button>
                </div>
              </div>

              {/* Question Analytics */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4 hover:border-slate-700">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <HelpCircle className="h-4 w-4 text-amber-300" /> Question Analytics
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Question language, difficulty, total attempts, correct count, and accuracy rate.
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-end">
                  <button
                    onClick={() => handleDownload("questions")}
                    disabled={downloadingSheet !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                  >
                    {downloadingSheet === "questions" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Export Question Analytics (.xlsx)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-950/40 rounded-b-2xl">
          <p className="text-xs text-slate-500">
            Exported Excel files are compatible with Microsoft Excel, Google Sheets, and LibreOffice Calc.
          </p>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
