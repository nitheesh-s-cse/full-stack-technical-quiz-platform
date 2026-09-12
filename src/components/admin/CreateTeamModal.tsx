"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    teamCode: "",
    teamName: "",
    member1: "",
    member2: "",
    member3: "",
    member4: "",
    collegeDept: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create team.");
        return;
      }
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Register New Team</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Team ID (e.g. TEAM006)" value={form.teamCode} onChange={(e) => setForm((p) => ({ ...p, teamCode: e.target.value.toUpperCase() }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input required placeholder="Team Name" value={form.teamName} onChange={(e) => setForm((p) => ({ ...p, teamName: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <input placeholder="College / Department" value={form.collegeDept} onChange={(e) => setForm((p) => ({ ...p, collegeDept: e.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Member 1" value={form.member1} onChange={(e) => setForm((p) => ({ ...p, member1: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input placeholder="Member 2" value={form.member2} onChange={(e) => setForm((p) => ({ ...p, member2: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input placeholder="Member 3" value={form.member3} onChange={(e) => setForm((p) => ({ ...p, member3: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input placeholder="Member 4" value={form.member4} onChange={(e) => setForm((p) => ({ ...p, member4: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-60">
            {saving ? "Creating..." : "Create Team"}
          </button>
        </form>
      </div>
    </div>
  );
}
