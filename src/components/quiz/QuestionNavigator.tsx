"use client";

type Props = {
  total: number;
  currentIndex: number;
  answeredSet: Set<number>;
  onJump: (index: number) => void;
};

export default function QuestionNavigator({ total, currentIndex, answeredSet, onJump }: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Questions</h3>
      <div className="grid grid-cols-5 gap-2 lg:grid-cols-4">
        {Array.from({ length: total }).map((_, i) => {
          const answered = answeredSet.has(i);
          const active = i === currentIndex;
          return (
            <button
              key={i}
              onClick={() => onJump(i)}
              className={[
                "flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition",
                active
                  ? "border-emerald-400 bg-emerald-500 text-slate-950"
                  : answered
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400"
                    : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500",
              ].join(" ")}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-4 space-y-1.5 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-emerald-500/40 bg-emerald-500/10" /> Answered
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-slate-700 bg-slate-950" /> Unanswered
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-emerald-400 bg-emerald-500" /> Current
        </div>
      </div>
    </div>
  );
}
