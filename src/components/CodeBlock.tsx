"use client";

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
  // Java
  "boolean", "byte", "extends", "implements", "final", "finally", "try", "catch", "throw", "throws",
  "new", "this", "super", "null", "true", "false", "instanceof", "package", "System", "out", "println",
  "print", "String", "Integer", "Double", "Override", "ArithmeticException", "Exception",
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
  const lines = (code || "").split(/\r?\n/);

  return (
    <div
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
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-mono-code">
          {language}
        </span>
      </div>
      <div className="overflow-x-auto p-4 font-mono-code text-[13.5px] leading-6">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              const tokens = tokenizeLine(line);
              return (
                <tr key={idx} className="hover:bg-slate-800/20">
                  <td className="w-10 select-none pr-4 text-right text-xs text-slate-600 align-top">
                    {idx + 1}
                  </td>
                  <td className="whitespace-pre align-top font-mono-code text-slate-200">
                    {tokens.length === 0 ? (
                      <span>&nbsp;</span>
                    ) : (
                      tokens.map((token, tIdx) => (
                        <span
                          key={tIdx}
                          style={{
                            color: token.color,
                            fontStyle: token.italic ? "italic" : "normal",
                          }}
                        >
                          {token.text}
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
