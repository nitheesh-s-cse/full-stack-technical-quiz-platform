"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { LANGUAGE_PRISM } from "@/lib/language-map";

export default function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div
      className="no-select overflow-hidden rounded-xl border border-slate-800 bg-[#0b0f19] shadow-inner"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1.5 border-b border-slate-800 bg-[#0e1420] px-4 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <span className="ml-3 text-xs text-slate-500">snippet.{language.toLowerCase()}</span>
      </div>
      <SyntaxHighlighter
        language={LANGUAGE_PRISM[language] ?? "text"}
        style={vscDarkPlus}
        showLineNumbers
        wrapLines
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "transparent",
          fontSize: "0.85rem",
          lineHeight: 1.6,
        }}
        codeTagProps={{ className: "font-mono-code" }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
