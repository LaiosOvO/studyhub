import { useState } from "react";
import type { Paper } from "../../../mocks/papers";
import { useNavigate } from "react-router-dom";

interface PaperCardProps {
  paper: Paper;
  onReadingList: (id: string) => Promise<void>;
}

const sourceColors: Record<string, string> = {
  arxiv: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  semantic_scholar: "text-accent-cyan bg-accent-cyan/10 border-accent-cyan/20",
  pubmed: "text-green-400 bg-green-400/10 border-green-400/20",
  openalex: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  cnki: "text-red-400 bg-red-400/10 border-red-400/20",
};

const sourceLabels: Record<string, string> = {
  arxiv: "arXiv",
  semantic_scholar: "S2",
  pubmed: "PubMed",
  openalex: "OpenAlex",
  cnki: "CNKI",
};

export default function PaperCard({ paper, onReadingList }: PaperCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [inList, setInList] = useState(false);
  const navigate = useNavigate();

  const displayAuthors = expanded ? paper.authors : paper.authors.slice(0, 5);
  const hasMoreAuthors = paper.authors.length > 5;

  const handleReadingList = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onReadingList(paper.id);
      setInList(true);
    } catch {
      // Parent handles error toast; don't toggle state on failure
    }
  };

  const qualityColor =
    paper.qualityScore >= 9 ? "bg-accent-cyan" : paper.qualityScore >= 7 ? "bg-amber-400" : "bg-red-400";

  return (
    <article className="glass rounded-xl border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 overflow-hidden flex">
      {/* Quality indicator bar */}
      <div
        className={`w-1 flex-shrink-0 ${qualityColor} opacity-70`}
        title={`质量分: ${paper.qualityScore}`}
      />

      <div className="flex-1 p-5">
        <div className="flex items-start gap-4">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3
              className="text-base font-semibold text-text-primary mb-2 leading-snug cursor-pointer hover:text-accent-cyan transition-colors line-clamp-2"
              onClick={() => navigate(`/papers/${paper.id}`)}
            >
              {paper.title}
            </h3>

            {/* Authors */}
            <p className="text-xs text-text-secondary mb-2">
              {displayAuthors.join(", ")}
              {hasMoreAuthors && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="ml-1 text-accent-cyan hover:underline cursor-pointer"
                >
                  等 {paper.authors.length - 5} 人
                </button>
              )}
            </p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted mb-3">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 flex items-center justify-center">
                  <i className="ri-calendar-line" />
                </span>
                {paper.year}
              </span>
              <span>·</span>
              <span className="truncate max-w-[200px]">{paper.venue}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 flex items-center justify-center">
                  <i className="ri-git-branch-line" />
                </span>
                {paper.citations.toLocaleString()} 引用
              </span>
            </div>

            {/* Abstract */}
            <p
              className={`text-sm text-text-secondary leading-relaxed mb-3 ${!expanded ? "line-clamp-3" : ""}`}
            >
              {paper.abstract}
            </p>
            {!expanded && paper.abstract.length > 200 && (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs text-accent-cyan hover:underline cursor-pointer mb-3"
              >
                展开摘要
              </button>
            )}

            {/* Tags */}
            <div className="flex flex-wrap items-center gap-2">
              {paper.isOpenAccess && (
                <span className="text-[10px] px-2 py-0.5 rounded-md font-medium text-green-400 bg-green-400/10 border border-green-400/20">
                  OA
                </span>
              )}
              <span
                className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                  sourceColors[paper.source] || "text-text-muted bg-white/[0.05] border-white/[0.08]"
                }`}
              >
                {sourceLabels[paper.source] || paper.source}
              </span>
              {paper.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-md text-text-muted bg-white/[0.03] border border-white/[0.06]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={handleReadingList}
              title="加入阅读列表"
              className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                inList
                  ? "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan"
                  : "border-white/[0.08] text-text-muted hover:border-accent-cyan/30 hover:text-accent-cyan"
              }`}
            >
              <i className={inList ? "ri-bookmark-fill text-sm" : "ri-bookmark-line text-sm"} />
            </button>
            <button
              onClick={() => navigate("/research/demo")}
              title="开始深度研究"
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-white/[0.08] text-text-muted hover:border-amber-400/30 hover:text-amber-400 transition-all cursor-pointer"
            >
              <i className="ri-rocket-line text-sm" />
            </button>
            <button
              onClick={() => navigate(`/papers/${paper.id}`)}
              title="查看引用图谱"
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-white/[0.08] text-text-muted hover:border-accent-cyan/30 hover:text-accent-cyan transition-all cursor-pointer"
            >
              <i className="ri-share-circle-line text-sm" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
