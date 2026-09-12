"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";

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
  const [round, setRound] = useState<1 | 2>(1);
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

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">Question Bank</h3>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs">
            {[1, 2].map((r) => (
              <button
                key={r}
                onClick={() => setRound(r as 1 | 2)}
                className={`rounded-md px-3 py-1.5 font-semibold ${round === r ? "bg-emerald-500 text-slate-950" : "text-slate-400"}`}
              >
                Round {r}
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

      {showForm && (
        <form onSubmit={createQuestion} className="mb-6 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <select value={form.language} onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              {["C", "CPP", "PYTHON", "HTML"].map((l) => (
                <option key={l} value={l}>{l}</option>
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
        {questions.map((q) => (
          <div key={q.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400">{q.language} · {q.difficulty} · {q.marks} mark(s) · correct: {q.correctOption}</p>
              <pre className="mt-1 max-h-16 overflow-hidden truncate whitespace-pre-wrap font-mono-code text-[11px] text-slate-500">{q.code}</pre>
            </div>
            <button onClick={() => deactivate(q.id)} className="shrink-0 rounded-md border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {questions.length === 0 && <p className="text-sm text-slate-600">No questions yet for Round {round}.</p>}
      </div>
    </div>
  );
}
