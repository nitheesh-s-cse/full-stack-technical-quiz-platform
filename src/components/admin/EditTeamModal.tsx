"use client";

import { useState } from "react";
import { X, Pencil, AlertCircle, Trash2 } from "lucide-react";

export type EditTeamTarget = {
  id: number;
  teamCode: string;
  teamName: string;
  member1Name?: string | null;
  member2Name?: string | null;
  member3Name?: string | null;
  member4Name?: string | null;
  members?: string[];
  collegeDept?: string | null;
};

export default function EditTeamModal({
  team,
  onClose,
  onSaved,
  onDelete,
}: {
  team: EditTeamTarget | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (team: EditTeamTarget) => void;
}) {
  const [form, setForm] = useState({
    teamCode: team?.teamCode ?? "",
    teamName: team?.teamName ?? "",
    member1: team?.member1Name ?? team?.members?.[0] ?? "",
    member2: team?.member2Name ?? team?.members?.[1] ?? "",
    member3: team?.member3Name ?? team?.members?.[2] ?? "",
    member4: team?.member4Name ?? team?.members?.[3] ?? "",
    collegeDept: team?.collegeDept ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!team) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams/${team!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamCode: form.teamCode,
          teamName: form.teamName,
          member1Name: form.member1,
          member2Name: form.member2,
          member3Name: form.member3,
          member4Name: form.member4,
          collegeDept: form.collegeDept,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update team.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Network error while updating team.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
              <Pencil className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-white">Edit Team Details</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Team Code / ID</label>
              <input
                type="text"
                required
                value={form.teamCode}
                onChange={(e) => setForm({ ...form, teamCode: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono-code text-xs text-white uppercase focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Team Name</label>
              <input
                type="text"
                required
                value={form.teamName}
                onChange={(e) => setForm({ ...form, teamName: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">College / Department</label>
            <input
              type="text"
              value={form.collegeDept}
              onChange={(e) => setForm({ ...form, collegeDept: e.target.value })}
              placeholder="e.g. CSE - Dept of Computer Science"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Team Members</label>
            <div className="space-y-2">
              <input
                type="text"
                value={form.member1}
                onChange={(e) => setForm({ ...form, member1: e.target.value })}
                placeholder="Member 1 Name"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
              <input
                type="text"
                value={form.member2}
                onChange={(e) => setForm({ ...form, member2: e.target.value })}
                placeholder="Member 2 Name (Optional)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
              <input
                type="text"
                value={form.member3}
                onChange={(e) => setForm({ ...form, member3: e.target.value })}
                placeholder="Member 3 Name (Optional)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
              <input
                type="text"
                value={form.member4}
                onChange={(e) => setForm({ ...form, member4: e.target.value })}
                placeholder="Member 4 Name (Optional)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(team);
                }}
                className="flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Team
              </button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-900/20 hover:bg-sky-500 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
