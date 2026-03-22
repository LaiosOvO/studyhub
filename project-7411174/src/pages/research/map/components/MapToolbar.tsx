import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CLUSTER_CONFIGS } from "../../../../mocks/graph";

export type ViewType = "graph" | "graph3d" | "topic" | "timeline";

interface MapToolbarProps {
  view: ViewType;
  onViewChange: (v: ViewType) => void;
  paperCount: number;
  yearRange: [number, number];
  onYearRangeChange: (r: [number, number]) => void;
  minCitations: number;
  onMinCitationsChange: (v: number) => void;
  activeCluster: number | null;
  onClusterChange: (c: number | null) => void;
  taskId: string;
}

export default function MapToolbar({
  view,
  onViewChange,
  paperCount,
  yearRange,
  onYearRangeChange,
  minCitations,
  onMinCitationsChange,
  activeCluster,
  onClusterChange,
  taskId,
}: MapToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const navigate = useNavigate();

  const views: { key: ViewType; icon: string; label: string }[] = [
    { key: "graph", icon: "ri-share-circle-line", label: "引用图谱" },
    { key: "graph3d", icon: "ri-cube-line", label: "3D 图谱" },
    { key: "topic", icon: "ri-bubble-chart-line", label: "主题地图" },
    { key: "timeline", icon: "ri-time-line", label: "时间线" },
  ];

  const citationOptions = [0, 1000, 5000, 10000];

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
      {/* View Switch */}
      <div className="glass rounded-xl p-1 border border-white/[0.1] flex gap-1">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => onViewChange(v.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
              view === v.key
                ? "bg-accent-cyan text-bg-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-white/[0.06]"
            }`}
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center">
              <i className={`${v.icon} text-xs`} />
            </span>
            {v.label}
          </button>
        ))}
      </div>

      {/* Stats pill */}
      <div className="glass rounded-xl px-3 py-2 border border-white/[0.1] flex items-center gap-2">
        <span className="w-3.5 h-3.5 flex items-center justify-center">
          <i className="ri-article-line text-xs text-accent-cyan" />
        </span>
        <span className="text-xs text-text-secondary font-mono">
          <strong className="text-text-primary">{paperCount}</strong> 篇
        </span>
      </div>

      {/* Filter */}
      <div className="relative">
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            filterOpen || activeCluster !== null || minCitations > 0
              ? "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan"
              : "glass border-white/[0.1] text-text-secondary hover:text-text-primary"
          }`}
        >
          <span className="w-3.5 h-3.5 flex items-center justify-center">
            <i className="ri-filter-3-line text-xs" />
          </span>
          筛选
          {(activeCluster !== null || minCitations > 0) && (
            <span className="w-4 h-4 rounded-full bg-accent-cyan text-bg-primary text-[9px] font-bold flex items-center justify-center">
              {(activeCluster !== null ? 1 : 0) + (minCitations > 0 ? 1 : 0)}
            </span>
          )}
        </button>

        {filterOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 glass rounded-2xl border border-white/[0.1] p-5 z-40 animate-fade-in space-y-5">
            {/* Year Range */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-3">
                发表年份：{yearRange[0]} – {yearRange[1]}
              </label>
              <div className="space-y-2">
                <input
                  type="range" min={2010} max={2026} value={yearRange[0]}
                  onChange={(e) => onYearRangeChange([parseInt(e.target.value), yearRange[1]])}
                  className="w-full h-1 accent-[#00D4B8] cursor-pointer"
                />
                <input
                  type="range" min={2010} max={2026} value={yearRange[1]}
                  onChange={(e) => onYearRangeChange([yearRange[0], parseInt(e.target.value)])}
                  className="w-full h-1 accent-[#00D4B8] cursor-pointer"
                />
              </div>
            </div>

            {/* Min Citations */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">最低引用数</label>
              <div className="grid grid-cols-4 gap-1.5">
                {citationOptions.map((c) => (
                  <button
                    key={c}
                    onClick={() => onMinCitationsChange(c)}
                    className={`py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                      minCitations === c
                        ? "bg-accent-cyan/10 border border-accent-cyan/40 text-accent-cyan"
                        : "bg-white/[0.04] border border-white/[0.06] text-text-muted hover:border-white/[0.12]"
                    }`}
                  >
                    {c === 0 ? "不限" : `${c >= 1000 ? `${c / 1000}k` : c}+`}
                  </button>
                ))}
              </div>
            </div>

            {/* Cluster Filter */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">研究方向</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => onClusterChange(null)}
                  className={`py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                    activeCluster === null
                      ? "bg-white/[0.08] border border-white/[0.2] text-text-primary"
                      : "bg-white/[0.03] border border-white/[0.06] text-text-muted hover:border-white/[0.12]"
                  }`}
                >
                  全部
                </button>
                {CLUSTER_CONFIGS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onClusterChange(activeCluster === c.id ? null : c.id)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                      activeCluster === c.id
                        ? "border"
                        : "bg-white/[0.03] border border-white/[0.06] text-text-muted hover:border-white/[0.12]"
                    }`}
                    style={
                      activeCluster === c.id
                        ? { color: c.color, backgroundColor: `${c.color}15`, borderColor: `${c.color}40` }
                        : {}
                    }
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="truncate">{c.shortName}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={() => { onClusterChange(null); onMinCitationsChange(0); onYearRangeChange([2010, 2026]); }}
              className="w-full py-2 rounded-lg text-xs text-text-muted border border-white/[0.06] hover:border-white/[0.15] hover:text-text-secondary cursor-pointer whitespace-nowrap transition-all"
            >
              重置筛选
            </button>
          </div>
        )}
      </div>

      {/* Report & Export */}
      <button
        onClick={() => navigate(`/research/${taskId}/report`)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass border border-white/[0.1] text-xs text-text-secondary hover:text-accent-cyan hover:border-accent-cyan/30 transition-all cursor-pointer whitespace-nowrap"
      >
        <span className="w-3.5 h-3.5 flex items-center justify-center">
          <i className="ri-file-chart-line text-xs" />
        </span>
        综述报告
      </button>

      <button className="w-9 h-9 flex items-center justify-center rounded-xl glass border border-white/[0.1] text-text-secondary hover:text-text-primary hover:border-white/[0.2] transition-all cursor-pointer">
        <i className="ri-download-line text-sm" />
      </button>
    </div>
  );
}
