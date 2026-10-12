"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, Filter } from "lucide-react";
import { LANGUAGE_COLORS, LANGUAGE_DISPLAY } from "@/lib/language-map";

type Question = {
  id: number;
  round: number;
  language: string;
  difficulty: string;
  code: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  marks: number;
  negativeMarks: number;
  isActive: boolean;
};

const emptyForm = {
  round: 1,
  language: "C",
  difficulty: "BASIC",
  code: "",
  questionText: "What will be the output of this program?",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "A",
  explanation: "",
  marks: 1,
  negativeMarks: 0,
};

export default function QuestionsPanel() {
  const [round, setRound] = useState<1 | 2 | 3>(1);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("ALL");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/admin/questions?round=${round}`);
    const data = await res.json();
    setQuestions(data.questions ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  async function createQuestion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, round }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create question.");
      return;
    }
    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  async function deactivate(id: number) {
    if (!confirm("Deactivate this question? It will no longer appear in new sessions.")) return;
    await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
    load();
  }

  const filteredQuestions = questions.filter((q) => {
    if (selectedLanguage === "ALL") return true;
    if (selectedLanguage === "CPP") return q.language === "CPP" || q.language === "C++";
    return q.language === selectedLanguage;
  });

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-100">Question Bank</h3>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs">
            {[1, 2, 3].map((r) => (
              <button
                key={r}
                onClick={() => setRound(r as 1 | 2 | 3)}
                className={`rounded-md px-3 py-1.5 font-semibold ${round === r ? "bg-emerald-500 text-slate-950" : "text-slate-400"}`}
              >
                {r === 3 ? "Tie-Breaker (R3)" : `Round ${r}`}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add Question
          </button>
        </div>
      </div>

      {/* Language Category Filter Tabs & Statistics */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {["ALL", "C", "CPP", "PYTHON", "HTML", "JAVA"].map((l) => {
          const count =
            l === "ALL"
              ? questions.length
              : questions.filter((q) => q.language === l || (l === "CPP" && q.language === "C++")).length;
          const active = selectedLanguage === l;
          return (
            <button
              key={l}
              type="button"
              onClick={() => setSelectedLanguage(l)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-semibold"
                  : "border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <span>{l === "ALL" ? "All Languages" : (LANGUAGE_DISPLAY[l] ?? l)}</span>
              <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {showForm && (
        <form onSubmit={createQuestion} className="mb-6 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <select
              value={form.language}
              onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              {["C", "CPP", "PYTHON", "HTML", "JAVA"].map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_DISPLAY[l] ?? l}
                </option>
              ))}
            </select>
            <select value={form.difficulty} onChange={(e) => setForm((p) => ({ ...p, difficulty: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              <option value="BASIC">BASIC</option>
              <option value="ADVANCED">ADVANCED</option>
            </select>
            <input type="number" placeholder="Marks" value={form.marks} onChange={(e) => setForm((p) => ({ ...p, marks: Number(e.target.value) }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input type="number" placeholder="Negative marks" value={form.negativeMarks} onChange={(e) => setForm((p) => ({ ...p, negativeMarks: Number(e.target.value) }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <textarea placeholder="Code snippet" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} rows={6} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono-code text-sm" />
          <input placeholder="Question text" value={form.questionText} onChange={(e) => setForm((p) => ({ ...p, questionText: e.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input placeholder="Option A" value={form.optionA} onChange={(e) => setForm((p) => ({ ...p, optionA: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input placeholder="Option B" value={form.optionB} onChange={(e) => setForm((p) => ({ ...p, optionB: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input placeholder="Option C" value={form.optionC} onChange={(e) => setForm((p) => ({ ...p, optionC: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input placeholder="Option D" value={form.optionD} onChange={(e) => setForm((p) => ({ ...p, optionD: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400">Correct option:</label>
            <select value={form.correctOption} onChange={(e) => setForm((p) => ({ ...p, correctOption: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              {["A", "B", "C", "D"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <textarea placeholder="Explanation (optional)" value={form.explanation} onChange={(e) => setForm((p) => ({ ...p, explanation: e.target.value }))} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400">
            Save Question to Round {round}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {filteredQuestions.map((q) => (
          <div key={q.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={[
                    "rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    LANGUAGE_COLORS[q.language] ?? "border-slate-700 bg-slate-800 text-slate-300",
                  ].join(" ")}
                >
                  {LANGUAGE_DISPLAY[q.language] ?? q.language}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {q.difficulty} · {q.marks} mark(s) · correct: {q.correctOption}
                </span>
              </div>
              <pre className="mt-1 max-h-16 overflow-hidden truncate whitespace-pre-wrap font-mono-code text-[11px] text-slate-500">{q.code}</pre>
            </div>
            <button onClick={() => deactivate(q.id)} className="shrink-0 rounded-md border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {filteredQuestions.length === 0 && (
          <p className="text-sm text-slate-600">
            {questions.length === 0
              ? `No questions yet for Round ${round}.`
              : `No ${selectedLanguage === "ALL" ? "" : (LANGUAGE_DISPLAY[selectedLanguage] ?? selectedLanguage)} questions found in Round ${round}.`}
          </p>
        )}
      </div>
    </div>
  );
}
