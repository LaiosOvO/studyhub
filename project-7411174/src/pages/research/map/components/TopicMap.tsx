import { useState } from "react";
import { mockGraphPapers, CLUSTER_CONFIGS, type GraphPaper } from "../../../../mocks/graph";

interface TopicMapProps {
  onSelectPaper: (paper: GraphPaper | null) => void;
  yearRange: [number, number];
  minCitations: number;
  activeCluster: number | null;
}

// Cluster label positions (approximate centroids in SVG coordinates)
const CLUSTER_LABEL_POSITIONS = [
  { x: 400, y: 300, name: "Transformer\n架构" },
  { x: 600, y: 140, name: "大语言\n模型" },
  { x: 640, y: 430, name: "计算机\n视觉" },
  { x: 400, y: 530, name: "生成模型" },
  { x: 160, y: 430, name: "图神经\n网络" },
  { x: 165, y: 140, name: "医疗 AI" },
  { x: 400, y: 60, name: "强化学习" },
];

export default function TopicMap({ onSelectPaper, yearRange, minCitations, activeCluster }: TopicMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Map paper positions from graph coordinates to SVG coordinates
  // Graph coords: x in [-900, 900], y in [-900, 700]
  // SVG coords: 800x600
  const SVG_W = 800;
  const SVG_H = 600;
  const GRAPH_X_MIN = -900;
  const GRAPH_X_MAX = 900;
  const GRAPH_Y_MIN = -900;
  const GRAPH_Y_MAX = 700;

  const toSvgX = (gx: number) =>
    ((gx - GRAPH_X_MIN) / (GRAPH_X_MAX - GRAPH_X_MIN)) * SVG_W;
  const toSvgY = (gy: number) =>
    ((gy - GRAPH_Y_MIN) / (GRAPH_Y_MAX - GRAPH_Y_MIN)) * SVG_H;

  const filteredPapers = mockGraphPapers.filter((p) => {
    if (p.year < yearRange[0] || p.year > yearRange[1]) return false;
    if (p.citations < minCitations) return false;
    if (activeCluster !== null && p.cluster !== activeCluster) return false;
    return true;
  });

  const getPointSize = (citations: number) => {
    const min = 4;
    const max = 20;
    const logMin = Math.log(500);
    const logMax = Math.log(160000);
    const logVal = Math.log(Math.max(citations, 500));
    return min + ((logVal - logMin) / (logMax - logMin)) * (max - min);
  };

  const hoveredPaper = mockGraphPapers.find((p) => p.id === hoveredId);

  return (
    <div className="w-full h-full flex flex-col bg-bg-primary relative overflow-hidden">
      {/* SVG Canvas */}
      <div className="flex-1 relative">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-full"
          style={{ background: "transparent" }}
          onClick={() => { setSelectedId(null); onSelectPaper(null); }}
        >
          {/* Grid */}
          <defs>
            <pattern id="topic-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="40" cy="40" r="0.8" fill="rgba(255,255,255,0.06)" />
            </pattern>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill="url(#topic-grid)" />

          {/* Cluster halos */}
          {CLUSTER_CONFIGS.map((cluster) => {
            const clusterPapers = filteredPapers.filter((p) => p.cluster === cluster.id);
            if (clusterPapers.length === 0) return null;
            const cx = clusterPapers.reduce((s, p) => s + toSvgX(p.x), 0) / clusterPapers.length;
            const cy = clusterPapers.reduce((s, p) => s + toSvgY(p.y), 0) / clusterPapers.length;
            const r = Math.max(
              ...clusterPapers.map((p) => Math.sqrt((toSvgX(p.x) - cx) ** 2 + (toSvgY(p.y) - cy) ** 2))
            ) + 30;
            return (
              <g key={cluster.id}>
                <circle
                  cx={cx} cy={cy} r={r}
                  fill={`${cluster.color}12`}
                  stroke={`${cluster.color}30`}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              </g>
            );
          })}

          {/* Cluster labels */}
          {CLUSTER_CONFIGS.map((cluster) => {
            const labelPos = CLUSTER_LABEL_POSITIONS[cluster.id];
            return (
              <text
                key={cluster.id}
                x={labelPos.x} y={labelPos.y}
                textAnchor="middle"
                style={{ fill: `${cluster.color}70`, fontSize: "10px", fontFamily: "Inter, sans-serif", fontWeight: 600 }}
              >
                {cluster.shortName}
              </text>
            );
          })}

          {/* Paper dots */}
          {filteredPapers.map((paper) => {
            const x = toSvgX(paper.x);
            const y = toSvgY(paper.y);
            const r = getPointSize(paper.citations);
            const color = CLUSTER_CONFIGS[paper.cluster].color;
            const isHovered = hoveredId === paper.id;
            const isSelected = selectedId === paper.id;
            const isDimmed = activeCluster !== null && paper.cluster !== activeCluster;
            return (
              <g key={paper.id}>
                {/* Glow for selected/hovered */}
                {(isHovered || isSelected) && (
                  <circle cx={x} cy={y} r={r + 6} fill={`${color}30`} />
                )}
                <circle
                  cx={x} cy={y} r={r}
                  fill={color}
                  fillOpacity={isDimmed ? 0.15 : isSelected ? 1 : isHovered ? 0.95 : 0.75}
                  stroke={isSelected ? "#ffffff" : isHovered ? color : "transparent"}
                  strokeWidth={isSelected ? 2 : 1}
                  style={{ cursor: "pointer", transition: "all 0.15s" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(paper.id);
                    onSelectPaper(paper);
                  }}
                  onMouseEnter={() => setHoveredId(paper.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPaper && (
          <div
            className="absolute pointer-events-none glass rounded-xl px-3 py-2.5 border border-white/[0.1] z-20 max-w-xs animate-fade-in"
            style={{ bottom: "20px", left: "50%", transform: "translateX(-50%)" }}
          >
            <p className="text-xs font-semibold text-text-primary line-clamp-1">{hoveredPaper.title}</p>
            <p className="text-[10px] text-text-muted mt-0.5">
              {hoveredPaper.year} ·{" "}
              <span className="font-mono" style={{ color: CLUSTER_CONFIGS[hoveredPaper.cluster].color }}>
                {hoveredPaper.citations.toLocaleString()} 引用
              </span>{" "}
              · {CLUSTER_CONFIGS[hoveredPaper.cluster].name}
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="absolute top-4 right-4 glass rounded-xl p-3 border border-white/[0.08] space-y-1.5">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">点大小 = 引用数</p>
          {[
            { label: "1k+", size: 4 },
            { label: "10k+", size: 8 },
            { label: "50k+", size: 14 },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center">
                <div
                  className="rounded-full bg-accent-cyan/60"
                  style={{ width: item.size * 2, height: item.size * 2 }}
                />
              </div>
              <span className="text-[10px] text-text-muted">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
