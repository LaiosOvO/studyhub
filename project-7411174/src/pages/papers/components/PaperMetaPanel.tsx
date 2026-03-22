import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { readingListsApi } from "../../../lib/api";
import { mockPaperDetail } from "../../../mocks/papers";

interface QualityDimension {
  name: string;
  score: number;
}

interface PaperMetaData {
  qualityScore: number;
  qualityDimensions: QualityDimension[];
  arxivId?: string;
  year: number;
  citations: number;
  venue: string;
  id: string;
}

interface PaperMetaPanelProps {
  paper?: PaperMetaData;
}

export default function PaperMetaPanel({ paper: paperProp }: PaperMetaPanelProps) {
  const paper = paperProp ?? mockPaperDetail;
  const navigate = useNavigate();
  const [inReadingList, setInReadingList] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToReadingList = useCallback(async () => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      let lists = await readingListsApi.list().catch(() => [] as { id: string }[]);
      if (!Array.isArray(lists)) lists = [];
      let listId: string;
      if (lists.length > 0) {
        listId = lists[0].id;
      } else {
        const created = await readingListsApi.create({ name: "默认阅读列表" });
        listId = created.id;
      }
      await readingListsApi.addPaper(listId, paper.id);
      setInReadingList(true);
    } catch (err) {
      console.error("Failed to add to reading list:", err);
    } finally {
      setIsAdding(false);
    }
  }, [paper.id, isAdding]);

  return (
    <div className="space-y-6">
      {/* Quality Score */}
      <div className="glass rounded-xl p-5 border border-white/[0.06]">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-star-line text-accent-cyan" />
          </span>
          质量评分
        </h3>
        <div className="text-center mb-4">
          <div className="text-5xl font-bold text-gradient-cyan font-mono">{paper.qualityScore}</div>
          <div className="text-xs text-text-muted mt-1">/ 10.0</div>
        </div>
        <div className="space-y-2.5">
          {paper.qualityDimensions.map((dim) => (
            <div key={dim.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-secondary">{dim.name}</span>
                <span className="text-text-primary font-mono">{dim.score}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-cyan-dim transition-all"
                  style={{ width: `${(dim.score / 10) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {paper.arxivId && (
          <a
            href={`https://arxiv.org/abs/${paper.arxivId}`}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent-cyan text-bg-primary text-sm font-semibold hover:bg-accent-cyan-dim transition-all cursor-pointer whitespace-nowrap"
          >
            <span className="w-4 h-4 flex items-center justify-center">
              <i className="ri-external-link-line" />
            </span>
            打开原文
          </a>
        )}
        <button
          onClick={handleAddToReadingList}
          disabled={isAdding}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm transition-all cursor-pointer whitespace-nowrap disabled:opacity-60 ${
            inReadingList
              ? "border-accent-cyan/40 text-accent-cyan bg-accent-cyan/[0.05]"
              : "border-white/[0.1] text-text-secondary hover:border-accent-cyan/30 hover:text-accent-cyan hover:bg-accent-cyan/[0.05]"
          }`}
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <i className={inReadingList ? "ri-bookmark-fill" : "ri-bookmark-line"} />
          </span>
          {isAdding ? "添加中..." : inReadingList ? "已加入阅读列表" : "加入阅读列表"}
        </button>
        <button
          onClick={() => navigate("/research/demo")}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-400/30 text-amber-400 text-sm hover:bg-amber-400/[0.05] transition-all cursor-pointer whitespace-nowrap"
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-flask-line" />
          </span>
          生成实验方案
        </button>
      </div>

      {/* Paper Metadata */}
      <div className="glass rounded-xl p-5 border border-white/[0.06] space-y-3">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">论文信息</h3>
        {[
          { icon: "ri-calendar-line", label: "发表年份", value: paper.year.toString() },
          { icon: "ri-git-branch-line", label: "被引用", value: `${paper.citations.toLocaleString()} 次` },
          { icon: "ri-book-open-line", label: "发表于", value: paper.venue },
          ...(paper.arxivId ? [{ icon: "ri-link", label: "arXiv ID", value: paper.arxivId }] : []),
        ].map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className={`${item.icon} text-xs text-text-muted`} />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] text-text-muted mb-0.5">{item.label}</div>
              <div className="text-xs text-text-primary truncate">{item.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
