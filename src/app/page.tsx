import Link from "next/link";
import { Terminal, ShieldCheck, Timer, Trophy, LayoutDashboard, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:44px_44px] opacity-20" />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
        <span className="mb-6 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
          VIYUGAM 2K26 · Technical Event
        </span>
        <h1 className="flex items-center gap-3 text-5xl font-black tracking-tight text-white sm:text-6xl">
          <Terminal className="h-12 w-12 text-emerald-400" />
          OUTPUT HUNT
        </h1>
        <p className="mt-5 max-w-2xl text-balance text-lg text-slate-400">
          A live, team-based, output-prediction coding contest across C, C++, Python and HTML.
          Two rounds. Real timers. Zero tolerance for malpractice. Fully server-verified scoring.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/quiz"
            className="group flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.6)] transition hover:bg-emerald-400"
          >
            <Users className="h-5 w-5" />
            Enter as a Team
          </Link>
          <Link
            href="/admin/login"
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-8 py-4 text-base font-bold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            <LayoutDashboard className="h-5 w-5" />
            Admin / Organizer Login
          </Link>
        </div>

        <div className="mt-16 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
          <InfoCard
            icon={<Timer className="h-5 w-5 text-sky-400" />}
            title="Round 1 — Basic Output"
            body="20 questions · C, C++, Python, HTML · short 10-15 line snippets · single correct answer."
          />
          <InfoCard
            icon={<Trophy className="h-5 w-5 text-amber-400" />}
            title="Round 2 — Advanced Output"
            body="10 questions for qualified teams only · 30-35 line snippets · advanced language behaviour."
          />
          <InfoCard
            icon={<ShieldCheck className="h-5 w-5 text-rose-400" />}
            title="Fair-Play Enforced"
            body="Server-authoritative timers, scoring and malpractice tracking. 3 confirmed violations = disqualification."
          />
        </div>

        <div className="mt-14 w-full rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-left">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">How it works</h2>
          <ol className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-400 sm:grid-cols-2">
            <li>1. Organizer registers all teams before the event.</li>
            <li>2. Team enters their Team ID on one shared device.</li>
            <li>3. Team reads the rules and enters fullscreen mode.</li>
            <li>4. Round 1 begins once the admin enables it.</li>
            <li>5. Admin reviews scores &amp; qualifies teams for Round 2.</li>
            <li>6. Qualified teams complete Round 2 under the same rules.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-slate-700">
      <div className="mb-3 flex items-center gap-2">{icon}<h3 className="font-semibold text-slate-100">{title}</h3></div>
      <p className="text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}
