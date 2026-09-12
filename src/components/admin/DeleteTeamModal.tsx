"use client";

import { useState } from "react";
import { X, Trash2, AlertTriangle, Loader2 } from "lucide-react";

export type DeleteTeamTarget = {
  id: number;
  teamCode: string;
  teamName: string;
};

export default function DeleteTeamModal({
  team,
  onClose,
  onDeleted,
}: {
  team: DeleteTeamTarget | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!team) return null;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams/${team!.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete team.");
        return;
      }
      onDeleted();
      onClose();
    } catch {
      setError("Network error occurred while deleting team.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 text-red-400">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Delete Team</h3>
              <p className="text-xs text-slate-400">Permanent removal confirmation</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3.5">
          <p className="text-sm text-slate-300">
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-white">{team.teamName}</span>{" "}
            (<span className="font-mono text-xs text-sky-400">{team.teamCode}</span>)?
          </p>

          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3.5 text-xs text-red-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>
                <strong>Warning:</strong> This will delete all team details, submissions, answers, scores, and malpractice logs. This action cannot be undone.
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-red-950/40 hover:bg-red-500 disabled:opacity-50"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deleting ? "Deleting..." : "Delete Team"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
