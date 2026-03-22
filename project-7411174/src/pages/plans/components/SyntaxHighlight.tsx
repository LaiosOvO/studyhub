import { ReactNode } from "react";

function tokenizeLine(line: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  let rest = line;
  let key = 0;

  const patterns: { re: RegExp; cls: string }[] = [
    { re: /^(#.*)/, cls: "text-[#475569]" },
    { re: /^("""[\s\S]*?"""|'''[\s\S]*?''')/, cls: "text-amber-300/80" },
    { re: /^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/, cls: "text-amber-300/80" },
    { re: /^(class|def|import|from|return|if|else|elif|for|while|in|not|and|or|True|False|None|self|super|lambda|with|as|try|except|raise|pass|break|continue)\b/, cls: "text-[#00D4B8]" },
    { re: /^(@\w+)/, cls: "text-amber-400" },
    { re: /^(\d+\.?\d*)/, cls: "text-green-300/80" },
    { re: /^(\w+)(?=\s*\()/, cls: "text-[#94A3B8]" },
  ];

  while (rest.length > 0) {
    let matched = false;
    for (const { re, cls } of patterns) {
      const m = rest.match(re);
      if (m) {
        tokens.push(<span key={key++} className={cls}>{m[0]}</span>);
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push(<span key={key++} className="text-[#94A3B8]">{rest[0]}</span>);
      rest = rest.slice(1);
    }
  }
  return tokens;
}

interface SyntaxHighlightProps {
  code: string;
  filename?: string;
}

/**
 * Syntax-highlighted Python code block with line numbers.
 * MLE-agent code preview pattern.
 */
export default function SyntaxHighlight({ code, filename = "model.py" }: SyntaxHighlightProps) {
  const lines = code.split("\n");

  return (
    <div className="rounded-xl bg-[#080C1A] border border-white/[0.08] overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="text-xs text-[#475569] font-mono">{filename}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00D4B8]/10 text-[#00D4B8] border border-[#00D4B8]/20 font-mono">Python</span>
          <span className="text-[10px] text-[#475569] ml-2">{lines.length} 行</span>
        </div>
      </div>

      {/* Code body */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono" cellPadding={0} cellSpacing={0}>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-white/[0.02] group">
                <td className="select-none text-right pr-4 pl-3 py-0.5 text-[#334155] w-10 border-r border-white/[0.04] group-hover:text-[#475569] transition-colors">
                  {i + 1}
                </td>
                <td className="pl-4 pr-4 py-0.5 leading-5 whitespace-pre">
                  {tokenizeLine(line)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
