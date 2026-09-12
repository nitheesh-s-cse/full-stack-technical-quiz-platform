"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, LogOut, RefreshCcw, Plus, Users, Trophy, Settings2, FileCode2 } from "lucide-react";
import TeamsTable, { type AdminTeamRow } from "@/components/admin/TeamsTable";
import AlertsFeed from "@/components/admin/AlertsFeed";
import SettingsPanel, { type Settings } from "@/components/admin/SettingsPanel";
import LeaderboardPanel from "@/components/admin/LeaderboardPanel";
import QuestionsPanel from "@/components/admin/QuestionsPanel";
import CreateTeamModal from "@/components/admin/CreateTeamModal";
import type { LiveEvent } from "@/lib/events";

type Tab = "teams" | "leaderboard" | "settings" | "questions";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState<string | null>(null);
  const [teams, setTeams] = useState<AdminTeamRow[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [tab, setTab] = useState<Tab>("teams");
  const [showCreate, setShowCreate] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadTeams = useCallback(async () => {
    const res = await fetch("/api/admin/teams", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    setTeams(data.teams ?? []);
  }, [router]);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setSettings(data.settings);
  }, []);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.admin) {
          router.replace("/admin/login");
          return;
        }
        setAdminName(d.admin.name ?? d.admin.username);
      });
  }, [router]);

  useEffect(() => {
    loadTeams();
    loadSettings();
    const interval = setInterval(loadTeams, 5000);
    return () => clearInterval(interval);
  }, [loadTeams, loadSettings]);

  useEffect(() => {
    if (!adminName) return;
    const es = new EventSource("/api/admin/stream");
    eventSourceRef.current = es;
    es.onmessage = (msg) => {
      try {
        const data: LiveEvent = JSON.parse(msg.data);
        if (data.type === "HEARTBEAT") return;
        setEvents((prev) => [data, ...prev].slice(0, 50));
        loadTeams();
      } catch {
        /* ignore malformed */
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects; nothing else required.
    };
    return () => es.close();
  }, [adminName, loadTeams]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  async function handleTerminate(id: number) {
    const reason = window.prompt("Reason for termination (visible in audit log):", "Manual termination by admin");
    if (reason === null) return;
    await fetch(`/api/admin/teams/${id}/terminate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    loadTeams();
  }

  async function handleQualify(id: number, qualified: boolean) {
    await fetch(`/api/admin/teams/${id}/qualify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qualified }),
    });
    loadTeams();
  }

  async function handleResetSession(id: number) {
    if (!window.confirm("Reset this team's device session? They will be able to log in from a new device.")) return;
    await fetch(`/api/admin/teams/${id}/reset-session`, { method: "POST" });
    loadTeams();
  }

  async function saveSettings(patch: Partial<Settings>) {
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (res.ok) setSettings(data.settings);
  }

  if (!adminName) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading console...</div>;
  }

  const activeCount = teams.filter((t) => t.teamStatus === "ACTIVE").length;
  const alertCount = teams.filter((t) => t.malpracticeCount > 0).length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-[#05070d]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <Terminal className="h-5 w-5 text-sky-400" />
            <div>
              <p className="text-sm font-bold text-white">OUTPUT HUNT — Organizer Console</p>
              <p className="text-[11px] text-slate-500">Signed in as {adminName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadTeams} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500">
              <RefreshCcw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Teams" value={teams.length} />
          <StatCard label="Active Now" value={activeCount} accent="text-emerald-400" />
          <StatCard label="Malpractice Alerts" value={alertCount} accent="text-amber-400" />
          <StatCard label="Terminated" value={teams.filter((t) => t.teamStatus === "TERMINATED").length} accent="text-red-400" />
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
            <TabButton icon={<Users className="h-4 w-4" />} label="Teams" active={tab === "teams"} onClick={() => setTab("teams")} />
            <TabButton icon={<Trophy className="h-4 w-4" />} label="Leaderboard" active={tab === "leaderboard"} onClick={() => setTab("leaderboard")} />
            <TabButton icon={<Settings2 className="h-4 w-4" />} label="Round Control" active={tab === "settings"} onClick={() => setTab("settings")} />
            <TabButton icon={<FileCode2 className="h-4 w-4" />} label="Questions" active={tab === "questions"} onClick={() => setTab("questions")} />
          </nav>
          {tab === "teams" && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400">
              <Plus className="h-4 w-4" /> Register Team
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          <div>
            {tab === "teams" && (
              <TeamsTable teams={teams} onTerminate={handleTerminate} onQualify={handleQualify} onResetSession={handleResetSession} />
            )}
            {tab === "leaderboard" && <LeaderboardPanel />}
            {tab === "settings" && settings && <SettingsPanel settings={settings} onSave={saveSettings} />}
            {tab === "questions" && <QuestionsPanel />}
          </div>
          <AlertsFeed events={events} />
        </div>
      </div>

      {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} onCreated={loadTeams} />}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-slate-100"}`}>{value}</p>
    </div>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition ${
        active ? "bg-sky-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {icon} {label}
    </button>
  );
}
