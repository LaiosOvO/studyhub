import { useState, useCallback } from "react";
import { type GraphPaper, CLUSTER_CONFIGS } from "../../../../mocks/graph";
import { readingListsApi } from "../../../../lib/api";

interface DetailPanelProps {
  paper: GraphPaper | null;
  onClose: () => void;
  onStartExperiment: (paper: GraphPaper) => void;
}

export default function DetailPanel({ paper, onClose, onStartExperiment }: DetailPanelProps) {
  const [readingListAdded, setReadingListAdded] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  const paperId = paper?.id ?? "";
  const isInReadingList = readingListAdded.has(paperId);

  const handleAddToReadingList = useCallback(async () => {
    if (isAdding || !paper) return;
    setIsAdding(true);
    try {
      // Get or create default reading list
      let lists = await readingListsApi.list().catch(() => [] as { id: string }[]);
      if (!Array.isArray(lists)) lists = [];
      let listId: string;
      if (lists.length > 0) {
        listId = lists[0].id;
      } else {
        const created = await readingListsApi.create({ name: "默认阅读列表" });
        listId = created.id;
      }
      if (isInReadingList) {
        await readingListsApi.removePaper(listId, paper.id);
        setReadingListAdded(prev => {
          const next = new Set(prev);
          next.delete(paper.id);
          return next;
        });
      } else {
        await readingListsApi.addPaper(listId, paper.id);
        setReadingListAdded(prev => {
          const next = new Set(prev);
          next.add(paper.id);
          return next;
        });
      }
    } catch (err) {
      // Don't toggle state on failure -- button stays unchanged to signal the error
      console.error("Failed to update reading list:", err);
    } finally {
      setIsAdding(false);
    }
  }, [paperId, isInReadingList, isAdding, paper]);

  if (!paper) return null;

  const cluster = CLUSTER_CONFIGS[paper.cluster];

  /** Build a URL to view/open this paper */
  const getPaperUrl = (): string | null => {
    if (paper.doi) return `https://doi.org/${paper.doi}`;
    // OpenAlex ID (W-prefixed) → OpenAlex page
    if (paper.id.startsWith("W")) return `https://openalex.org/${paper.id}`;
    // S2 paperId (40-char hex) → Semantic Scholar page
    if (/^[0-9a-f]{40}$/i.test(paper.id)) return `https://www.semanticscholar.org/paper/${paper.id}`;
    return null;
  };
  const paperUrl = getPaperUrl();

  return (
    <aside
      className="absolute top-0 right-0 h-full w-80 z-20 flex flex-col border-l border-white/[0.08] animate-slide-right"
      style={{ background: "rgba(13, 20, 40, 0.92)", backdropFilter: "blur(20px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cluster.color }} />
          <span className="text-xs font-medium" style={{ color: cluster.color }}>{cluster.name}</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.05] cursor-pointer transition-all"
        >
          <i className="ri-close-line text-sm" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Title & Meta */}
        <div>
          {paperUrl ? (
            <a
              href={paperUrl}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="text-base font-bold text-text-primary leading-snug mb-2 block hover:text-accent-cyan transition-colors cursor-pointer"
            >
              {paper.title} <i className="ri-external-link-line text-xs text-text-muted" />
            </a>
          ) : (
            <h2 className="text-base font-bold text-text-primary leading-snug mb-2">{paper.title}</h2>
          )}
          <p className="text-xs text-text-muted">{paper.authors.join(", ")}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <i className="ri-calendar-line text-xs" />{paper.year}
            </span>
            <span>·</span>
            <span className="truncate max-w-[140px]">{paper.venue}</span>
            <span>·</span>
            <span className="flex items-center gap-1 font-mono font-semibold" style={{ color: cluster.color }}>
              <i className="ri-git-branch-line text-xs" />
              {paper.citations.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Quality Score */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted">质量分</span>
            <span className="text-lg font-bold font-mono text-gradient-cyan">{paper.qualityScore}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(paper.qualityScore / 10) * 100}%`,
                background: `linear-gradient(90deg, ${cluster.color}, ${cluster.color}80)`,
              }}
            />
          </div>
        </div>

        {/* Abstract */}
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">摘要</h4>
          <p className="text-xs text-text-secondary leading-relaxed">{paper.abstract}</p>
        </div>

        {/* Methods */}
        {paper.methods && paper.methods.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">核心方法</h4>
            <div className="flex flex-wrap gap-1.5">
              {paper.methods.map((m) => (
                <span
                  key={m}
                  className="text-[10px] px-2 py-0.5 rounded-lg border"
                  style={{ color: cluster.color, backgroundColor: `${cluster.color}15`, borderColor: `${cluster.color}30` }}
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Research Gap */}
        {paper.researchGap && (
          <div className="p-3 rounded-xl bg-amber-400/[0.06] border border-amber-400/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <i className="ri-lightbulb-line text-xs text-amber-400" />
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">AI 发现研究空白</span>
            </div>
            <p className="text-xs text-amber-200/70 leading-relaxed">{paper.researchGap}</p>
          </div>
        )}

        {/* Citation Network Info */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
            <div className="text-base font-bold font-mono text-gradient-cyan">
              {paper.citations.toLocaleString()}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">被引用次数</div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
            <div className="text-base font-bold font-mono text-text-primary">{paper.year}</div>
            <div className="text-[10px] text-text-muted mt-0.5">发表年份</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-white/[0.06] space-y-2">
        {paperUrl && (
          <a
            href={paperUrl}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.1] text-xs font-medium text-text-secondary hover:border-white/[0.2] hover:text-text-primary transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-external-link-line" /> 打开原文
          </a>
        )}
        <button
          onClick={handleAddToReadingList}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            isInReadingList
              ? "border-accent-cyan/40 text-accent-cyan bg-accent-cyan/10"
              : "border-white/[0.1] text-text-secondary hover:border-white/[0.2] hover:text-text-primary"
          }`}
        >
          <i className={isInReadingList ? "ri-bookmark-fill" : "ri-bookmark-line"} />
          {isInReadingList ? "已加入阅读列表" : "加入阅读列表"}
        </button>
        <button
          onClick={() => onStartExperiment(paper)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
          style={{ backgroundColor: cluster.color, color: "#080C1A" }}
        >
          <i className="ri-flask-line" /> 基于此论文生成实验
        </button>
      </div>
    </aside>
  );
}
