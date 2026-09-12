"use client";

type Props = {
  label: "A" | "B" | "C" | "D";
  text: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export default function AnswerCard({ label, text, selected, disabled, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={[
        "no-select group flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400/60"
          : "border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono-code text-sm font-bold",
          selected ? "border-emerald-400 bg-emerald-500 text-slate-950" : "border-slate-700 text-slate-400 group-hover:border-slate-500",
        ].join(" ")}
      >
        {label}
      </span>
      <span className="font-mono-code text-sm text-slate-200 sm:text-base">{text}</span>
    </button>
  );
}
