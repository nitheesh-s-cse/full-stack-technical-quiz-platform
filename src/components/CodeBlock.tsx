"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

type Props = {
  code: string;
  language: string;
};

type Token = { text: string; color: string; italic?: boolean };

const KEYWORDS = new Set([
  // C / C++
  "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum",
  "extern", "float", "for", "goto", "if", "int", "long", "register", "return", "short", "signed",
  "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while",
  "class", "public", "private", "protected", "namespace", "using", "std", "cout", "cin", "endl",
  "include", "iostream", "stdio", "vector", "string", "printf", "scanf", "malloc", "free", "template",
  // Python
  "def", "import", "from", "as", "class", "return", "if", "elif", "else", "for", "while", "in", "is",
  "not", "and", "or", "try", "except", "finally", "with", "lambda", "yield", "pass", "raise", "print",
  "len", "range", "self", "True", "False", "None", "list", "dict", "set", "int", "str",
  // HTML / General
  "doctype", "html", "head", "body", "div", "span", "script", "style", "function", "var", "let", "const"
]);

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Single line comments
    if (line.slice(i, i + 2) === "//" || line[i] === "#") {
      tokens.push({ text: line.slice(i), color: "#64748b", italic: true });
      break;
    }

    // Double quoted string
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') {
        if (line[j] === "\\" && j + 1 < line.length) j++;
        j++;
      }
      tokens.push({ text: line.slice(i, j + 1), color: "#4ade80" });
      i = j + 1;
      continue;
    }

    // Single quoted string
    if (line[i] === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== "'") {
        if (line[j] === "\\" && j + 1 < line.length) j++;
        j++;
      }
      tokens.push({ text: line.slice(i, j + 1), color: "#4ade80" });
      i = j + 1;
      continue;
    }

    // Numbers
    if (/\d/.test(line[i])) {
      let j = i;
      while (j < line.length && /[\d.xXa-fA-F]/.test(line[j])) {
        j++;
      }
      tokens.push({ text: line.slice(i, j), color: "#fb923c" });
      i = j;
      continue;
    }

    // Words / Identifiers
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) {
        j++;
      }
      const word = line.slice(i, j);
      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, color: "#38bdf8" });
      } else {
        tokens.push({ text: word, color: "#e2e8f0" });
      }
      i = j;
      continue;
    }

    // Operators and punctuation
    const char = line[i];
    if (/[+\-*/%=<>!&|^~?:;,.]/.test(char)) {
      tokens.push({ text: char, color: "#f43f5e" });
    } else if (/[(){}[\]]/.test(char)) {
      tokens.push({ text: char, color: "#facc15" });
    } else {
      tokens.push({ text: char, color: "#94a3b8" });
    }
    i++;
  }

  return tokens;
}

export default function CodeBlock({ code, language }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const lines = (code || "").split(/\r?\n/);
    const maxLineNumStr = String(Math.max(1, lines.length));
    const lineNumGutterWidth = Math.max(38, 16 + maxLineNumStr.length * 9);

    const fontStyle = "13.5px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.font = fontStyle;

    // Measure maximum code width
    let maxLineWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }

    const paddingLeft = lineNumGutterWidth + 16;
    const paddingRight = 28;
    const paddingTop = 16;
    const paddingBottom = 16;
    const lineHeight = 22;

    const contentWidth = paddingLeft + maxLineWidth + paddingRight;
    const currentContainerWidth = containerWidth || container.clientWidth || 600;
    const cssWidth = Math.max(currentContainerWidth, contentWidth);
    const cssHeight = paddingTop + paddingBottom + lines.length * lineHeight;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.ceil(cssWidth * dpr);
    canvas.height = Math.ceil(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Fill base background
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // 2. Fill gutter background
    ctx.fillStyle = "#080c14";
    ctx.fillRect(0, 0, lineNumGutterWidth, cssHeight);

    // 3. Draw vertical divider between gutter and code
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lineNumGutterWidth, 0);
    ctx.lineTo(lineNumGutterWidth, cssHeight);
    ctx.stroke();

    // 4. Anti-OCR Defense 1: Micro-noise pattern
    const dotCount = Math.floor((cssWidth * cssHeight) / 380);
    ctx.fillStyle = "rgba(148, 163, 184, 0.04)";
    for (let i = 0; i < dotCount; i++) {
      const rx = (Math.sin(i * 997 + 1) * 0.5 + 0.5) * cssWidth;
      const ry = (Math.cos(i * 733 + 2) * 0.5 + 0.5) * cssHeight;
      ctx.fillRect(rx, ry, 1.2, 1.2);
    }

    // 5. Anti-OCR Defense 2: Micro-mesh lines
    ctx.strokeStyle = "rgba(56, 189, 248, 0.015)";
    ctx.lineWidth = 0.5;
    for (let y = 14; y < cssHeight; y += 44) {
      ctx.beginPath();
      ctx.moveTo(lineNumGutterWidth, y);
      ctx.lineTo(cssWidth, y + 4);
      ctx.stroke();
    }

    // 6. Anti-OCR Defense 3: Semi-transparent decoy glyphs behind code
    const decoyChars = [";", "}", "_", "|", "0", "l", "~", "{", "1"];
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
    const decoyCount = Math.floor(cssHeight / 24);
    for (let d = 0; d < decoyCount; d++) {
      const char = decoyChars[d % decoyChars.length];
      const dx = lineNumGutterWidth + 20 + ((Math.sin(d * 421) * 0.5 + 0.5) * (cssWidth - lineNumGutterWidth - 40));
      const dy = 20 + d * 24;
      ctx.fillText(char, dx, dy);
    }

    // 7. Render line numbers and code text
    ctx.textBaseline = "middle";

    for (let i = 0; i < lines.length; i++) {
      const lineY = paddingTop + i * lineHeight + lineHeight / 2;

      // Draw line number
      ctx.font = fontStyle;
      ctx.fillStyle = "#475569";
      ctx.textAlign = "right";
      ctx.fillText(String(i + 1), lineNumGutterWidth - 8, lineY);

      // Draw code tokens
      ctx.textAlign = "left";
      let currentX = paddingLeft;
      const tokens = tokenizeLine(lines[i]);

      for (const token of tokens) {
        ctx.font = token.italic ? `italic ${fontStyle}` : fontStyle;
        ctx.fillStyle = token.color;
        ctx.fillText(token.text, currentX, lineY);
        currentX += ctx.measureText(token.text).width;
      }
    }

    ctx.restore();
  }, [code, language, containerWidth]);

  return (
    <div
      ref={containerRef}
      className="no-select select-none overflow-hidden rounded-xl border border-slate-800 bg-[#0b0f19] shadow-inner"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      draggable={false}
    >
      <div className="flex items-center justify-between border-b border-slate-800 bg-[#0e1420] px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          <span className="ml-3 text-xs text-slate-500 font-mono-code">snippet.{language.toLowerCase()}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Anti-OCR Canvas Protected</span>
        </div>
      </div>
      <div
        className="overflow-x-auto overflow-y-hidden max-w-full touch-pan-x"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <canvas
          ref={canvasRef}
          className="block select-none pointer-events-none"
        />
      </div>
    </div>
  );
}
