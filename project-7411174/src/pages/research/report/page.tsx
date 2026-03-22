import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../../components/feature/Navbar";
import Footer from "../../../components/feature/Footer";
import { researchApi } from "../../../lib/api";

// ── Safe inline text renderer — no dangerouslySetInnerHTML ──────────────────
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          const inner = part.slice(2, -2);
          if (inner.startsWith("\u26a0\ufe0f")) {
            return <strong key={i} className="text-amber-300 font-semibold">{inner}</strong>;
          }
          return <strong key={i} className="text-text-primary font-semibold">{inner}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Block-level markdown tokenizer ─────────────────────────────────────────
type Block =
  | { type: "h2"; text: string; anchor: string }
  | { type: "h3"; text: string }
  | { type: "warning"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "bullet"; text: string }
  | { type: "numbered"; text: string; num: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" }
  | { type: "blank" }
  | { type: "paragraph"; text: string };

function tokenize(content: string): Block[] {
  const rawLines = content.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];

    if (line.startsWith("## ")) {
      const text = line.slice(3);
      const anchor = `section-${blocks.length}`;
      blocks.push({ type: "h2", text, anchor });
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4) });
      i++;
      continue;
    }

    if (line.startsWith("---")) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (line.startsWith("> ")) {
      blocks.push({ type: "blockquote", text: line.slice(2) });
      i++;
      continue;
    }

    if (line.startsWith("**\u26a0\ufe0f")) {
      blocks.push({ type: "warning", text: line.replace(/^\*\*/, "").replace(/\*\*$/, "") });
      i++;
      continue;
    }

    if (line.startsWith("- ")) {
      blocks.push({ type: "bullet", text: line.slice(2) });
      i++;
      continue;
    }

    const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      blocks.push({ type: "numbered", text: numberedMatch[2], num: numberedMatch[1] });
      i++;
      continue;
    }

    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].startsWith("|")) {
        tableLines.push(rawLines[i]);
        i++;
      }
      const parseCells = (l: string) =>
        l.split("|").filter(Boolean).map((c) => c.trim());

      const headers = parseCells(tableLines[0]);
      const rows: string[][] = [];
      const startRow = tableLines[1] && tableLines[1].replace(/[\s|:-]/g, "").length === 0 ? 2 : 1;
      for (let r = startRow; r < tableLines.length; r++) {
        rows.push(parseCells(tableLines[r]));
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (!line.trim()) {
      blocks.push({ type: "blank" });
      i++;
      continue;
    }

    blocks.push({ type: "paragraph", text: line });
    i++;
  }

  return blocks;
}

function extractToc(blocks: Block[]): { text: string; anchor: string }[] {
  return blocks
    .filter((b): b is Extract<Block, { type: "h2" }> => b.type === "h2")
    .map((b) => ({ text: b.text, anchor: b.anchor }));
}

function RenderBlock({ block, index }: { block: Block; index: number }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 id={block.anchor} key={index}
          className="text-xl font-bold text-text-primary mt-10 mb-4 flex items-center gap-3 scroll-mt-24">
          <span className="w-1 h-5 rounded-full bg-accent-cyan flex-shrink-0" />
          <a href={`#${block.anchor}`} className="text-text-primary hover:text-accent-cyan transition-colors">
            {block.text}
          </a>
        </h2>
      );
    case "h3":
      return <h3 key={index} className="text-base font-semibold text-text-primary mt-6 mb-3">{block.text}</h3>;
    case "warning":
      return (
        <div key={index} className="my-4 p-4 rounded-xl bg-amber-400/[0.06] border border-amber-400/20">
          <p className="text-sm text-amber-300 leading-relaxed"><InlineText text={block.text} /></p>
        </div>
      );
    case "blockquote":
      return (
        <blockquote key={index} className="border-l-2 border-accent-cyan/40 pl-4 my-3">
          <p className="text-sm text-text-secondary italic leading-relaxed">{block.text}</p>
        </blockquote>
      );
    case "bullet":
      return <li key={index} className="text-sm text-text-secondary leading-relaxed ml-4 list-disc mb-1"><InlineText text={block.text} /></li>;
    case "numbered":
      return <li key={index} className="text-sm text-text-secondary leading-relaxed ml-4 list-decimal mb-1"><InlineText text={block.text} /></li>;
    case "table":
      return (
        <div key={index} className="my-5 overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full min-w-max">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                {block.headers.map((h, j) => (
                  <th key={j} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary whitespace-nowrap">
                    <InlineText text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-xs text-text-secondary"><InlineText text={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "hr":
      return <hr key={index} className="border-white/[0.08] my-6" />;
    case "blank":
      return <div key={index} className="h-2" />;
    case "paragraph":
      return <p key={index} className="text-sm text-text-secondary leading-relaxed"><InlineText text={block.text} /></p>;
    default:
      return null;
  }
}

function groupListItems(blocks: Block[]): (Block | { type: "ul"; items: Block[] } | { type: "ol"; items: Block[] })[] {
  const result: (Block | { type: "ul"; items: Block[] } | { type: "ol"; items: Block[] })[] = [];
  let i = 0;
  while (i < blocks.length) {
    if (blocks[i].type === "bullet") {
      const items: Block[] = [];
      while (i < blocks.length && blocks[i].type === "bullet") { items.push(blocks[i]); i++; }
      result.push({ type: "ul", items });
    } else if (blocks[i].type === "numbered") {
      const items: Block[] = [];
      while (i < blocks.length && blocks[i].type === "numbered") { items.push(blocks[i]); i++; }
      result.push({ type: "ol", items });
    } else {
      result.push(blocks[i]);
      i++;
    }
  }
  return result;
}

function RenderGroupedBlock({
  block, index,
}: {
  block: Block | { type: "ul"; items: Block[] } | { type: "ol"; items: Block[] };
  index: number;
}) {
  if (block.type === "ul") {
    return <ul key={index} className="my-3 space-y-0.5 list-disc list-inside">{block.items.map((item, i) => <RenderBlock key={i} block={item} index={i} />)}</ul>;
  }
  if (block.type === "ol") {
    return <ol key={index} className="my-3 space-y-0.5 list-decimal list-inside">{block.items.map((item, i) => <RenderBlock key={i} block={item} index={i} />)}</ol>;
  }
  return <RenderBlock key={index} block={block as Block} index={index} />;
}

// ── TOC Sidebar ─────────────────────────────────────────────────────────────
function TocSidebar({ toc, activeSection }: { toc: { text: string; anchor: string }[]; activeSection: string }) {
  return (
    <nav className="glass rounded-xl p-5 border border-white/[0.06]">
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">目录</h4>
      <ul className="space-y-1">
        {toc.map((item) => (
          <li key={item.anchor}>
            <a href={`#${item.anchor}`}
              className={`block text-xs leading-relaxed py-1.5 px-2.5 rounded-lg transition-all ${
                activeSection === item.anchor
                  ? "text-accent-cyan bg-accent-cyan/10"
                  : "text-text-muted hover:text-text-secondary hover:bg-white/[0.04]"
              }`}>
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function ResearchReportPage() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const [activeSection] = useState("section-0");

  const [reportContent, setReportContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real report from API
  useEffect(() => {
    if (!taskId) {
      setError("缺少任务 ID");
      setLoading(false);
      return;
    }
    researchApi.getReport(taskId)
      .then((content) => {
        setReportContent(content);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "加载报告失败");
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-40 gap-4">
          <i className="ri-loader-4-line animate-spin text-accent-cyan text-3xl" />
          <p className="text-sm text-text-muted">加载研究报告...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !reportContent) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="max-w-lg mx-auto pt-32 text-center">
          <div className="w-16 h-16 rounded-full bg-red-400/10 border-2 border-red-400 flex items-center justify-center mx-auto mb-4">
            <i className="ri-file-warning-line text-2xl text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-2">报告加载失败</h1>
          <p className="text-sm text-text-secondary mb-6">{error || "报告内容为空"}</p>
          <button onClick={() => navigate(-1)}
            className="px-6 py-2.5 rounded-xl border border-white/[0.1] text-sm text-text-secondary hover:text-text-primary cursor-pointer transition-all">
            返回
          </button>
        </div>
      </div>
    );
  }

  const blocks = tokenize(reportContent);
  const grouped = groupListItems(blocks);
  const toc = extractToc(blocks);

  // Compute stats from actual content
  const charCount = reportContent.length;
  const h2Count = toc.length;

  const handleDownloadMd = () => {
    const blob = new Blob([reportContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-report-${taskId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <div className="max-w-[1200px] mx-auto px-6 pt-24 pb-16">
        <div className="flex gap-8">
          {/* Main Report */}
          <main className="flex-1 min-w-0" id="main-content">
            <article className="glass rounded-2xl p-8 border border-white/[0.06] mb-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan">
                      文献综述报告
                    </span>
                    <span className="text-xs text-text-muted">任务 {taskId?.slice(0, 8)}...</span>
                  </div>
                  <h1 className="text-2xl font-bold text-text-primary mb-2">深度研究报告</h1>
                  <p className="text-text-muted text-sm">{charCount.toLocaleString()} 字符 · {h2Count} 个章节</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={handleDownloadMd}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] text-xs text-text-secondary hover:border-white/[0.2] hover:text-text-primary cursor-pointer whitespace-nowrap transition-all">
                    <i className="ri-markdown-line" /> 导出 MD
                  </button>
                </div>
              </div>

              {/* Report Body */}
              <div className="space-y-0.5">
                {grouped.map((block, i) => (
                  <RenderGroupedBlock key={i} block={block} index={i} />
                ))}
              </div>
            </article>
          </main>

          {/* Right Sidebar */}
          <aside className="w-56 flex-shrink-0 space-y-4">
            {/* Stats */}
            <div className="glass rounded-xl p-5 border border-white/[0.06]">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">报告统计</h4>
              {[
                { label: "字符数", value: charCount.toLocaleString() },
                { label: "章节数", value: String(h2Count) },
              ].map((stat) => (
                <div key={stat.label} className="flex justify-between items-center py-2 border-b border-white/[0.04] last:border-0">
                  <span className="text-xs text-text-muted">{stat.label}</span>
                  <span className="text-xs font-semibold text-text-primary font-mono">{stat.value}</span>
                </div>
              ))}
            </div>

            {/* TOC */}
            <TocSidebar toc={toc} activeSection={activeSection} />

            {/* Actions */}
            <button onClick={() => navigate(taskId ? `/research/${taskId}` : "/research/new")}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-cyan text-bg-primary text-sm font-semibold hover:bg-accent-cyan-dim cursor-pointer whitespace-nowrap transition-all">
              <i className="ri-mind-map" /> 查看论文地图
            </button>

            {/* Agent document generation */}
            <div className="glass rounded-xl p-4 border border-white/[0.06] space-y-2">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">AI 文档生成</h4>
              <button onClick={() => navigate(`/agent/new${taskId ? `?taskId=${taskId}` : ""}`)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/[0.1] text-text-secondary text-xs hover:border-accent-cyan/30 hover:text-accent-cyan hover:bg-accent-cyan/[0.05] cursor-pointer whitespace-nowrap transition-all">
                <i className="ri-book-open-line" /> 生成文献综述
              </button>
              <button onClick={() => navigate(`/agent/new${taskId ? `?taskId=${taskId}` : ""}`)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/[0.1] text-text-secondary text-xs hover:border-accent-cyan/30 hover:text-accent-cyan hover:bg-accent-cyan/[0.05] cursor-pointer whitespace-nowrap transition-all">
                <i className="ri-flask-line" /> 生成实验方案
              </button>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}
