import { useState } from "react";
import { mockGraphPapers, CLUSTER_CONFIGS, type GraphPaper } from "../../../../mocks/graph";

interface TimelineViewProps {
  onSelectPaper: (paper: GraphPaper | null) => void;
  yearRange: [number, number];
  minCitations: number;
  activeCluster: number | null;
}

const YEAR_MIN = 2014;
const YEAR_MAX = 2026;

export default function TimelineView({ onSelectPaper, yearRange, minCitations, activeCluster }: TimelineViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const years = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

  const filteredPapers = mockGraphPapers.filter((p) => {
    if (p.year < yearRange[0] || p.year > yearRange[1]) return false;
    if (p.citations < minCitations) return false;
    if (p.year < YEAR_MIN || p.year > YEAR_MAX) return false;
    return true;
  });

  const displayClusters = activeCluster !== null
    ? CLUSTER_CONFIGS.filter((c) => c.id === activeCluster)
    : CLUSTER_CONFIGS;

  const getNodeRadius = (citations: number) => {
    const min = 8;
    const max = 24;
    const logMin = Math.log(500);
    const logMax = Math.log(160000);
    const logVal = Math.log(Math.max(citations, 500));
    return Math.round(min + ((logVal - logMin) / (logMax - logMin)) * (max - min));
  };

  const ROW_HEIGHT = 80;
  const PADDING_LEFT = 80;
  const YEAR_WIDTH = 80;
  const SVG_WIDTH = PADDING_LEFT + (years.length - 1) * YEAR_WIDTH + 60;

  const getX = (year: number) =>
    PADDING_LEFT + (year - YEAR_MIN) * YEAR_WIDTH;

  // For each cluster row, position papers in the row
  const papersByCluster: Record<number, (typeof mockGraphPapers)> = {};
  displayClusters.forEach((c) => {
    papersByCluster[c.id] = filteredPapers.filter((p) => p.cluster === c.id);
  });

  return (
    <div className="w-full h-full bg-bg-primary overflow-auto">
      <div style={{ minWidth: SVG_WIDTH + "px", height: "100%" }}>
        <svg
          width={SVG_WIDTH}
          height={displayClusters.length * ROW_HEIGHT + 80}
          onClick={() => { setSelectedId(null); onSelectPaper(null); }}
        >
          {/* Background */}
          <rect width={SVG_WIDTH} height={displayClusters.length * ROW_HEIGHT + 80} fill="transparent" />

          {/* Year header */}
          {years.map((y) => (
            <g key={y}>
              <line
                x1={getX(y)} y1={20}
                x2={getX(y)} y2={displayClusters.length * ROW_HEIGHT + 60}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={y % 5 === 0 ? 1.5 : 1}
                strokeDasharray={y % 5 === 0 ? "none" : "3 4"}
              />
              <text
                x={getX(y)} y={15}
                textAnchor="middle"
                style={{ fill: "rgba(255,255,255,0.3)", fontSize: "11px", fontFamily: "JetBrains Mono, monospace" }}
              >
                {y}
              </text>
            </g>
          ))}

          {/* Cluster rows */}
          {displayClusters.map((cluster, rowIdx) => {
            const rowY = 30 + rowIdx * ROW_HEIGHT;
            const papers = papersByCluster[cluster.id] || [];

            return (
              <g key={cluster.id}>
                {/* Row background */}
                <rect
                  x={0} y={rowY + 5}
                  width={SVG_WIDTH} height={ROW_HEIGHT - 10}
                  fill={rowIdx % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent"}
                  rx={4}
                />

                {/* Cluster label */}
                <text
                  x={PADDING_LEFT - 10} y={rowY + ROW_HEIGHT / 2 + 4}
                  textAnchor="end"
                  style={{ fill: cluster.color, fontSize: "11px", fontWeight: 600, fontFamily: "Inter, sans-serif" }}
                >
                  {cluster.shortName}
                </text>

                {/* Timeline axis for this row */}
                <line
                  x1={PADDING_LEFT - 8} y1={rowY + ROW_HEIGHT / 2}
                  x2={SVG_WIDTH - 20} y2={rowY + ROW_HEIGHT / 2}
                  stroke={`${cluster.color}30`}
                  strokeWidth={1}
                />

                {/* Paper nodes */}
                {papers.map((paper) => {
                  const x = getX(paper.year);
                  const y = rowY + ROW_HEIGHT / 2;
                  const r = getNodeRadius(paper.citations);
                  const isHovered = hoveredId === paper.id;
                  const isSelected = selectedId === paper.id;
                  const isMilestone = paper.citations > 20000;

                  return (
                    <g key={paper.id}>
                      {/* Glow */}
                      {(isHovered || isSelected || isMilestone) && (
                        <circle
                          cx={x} cy={y} r={r + 5}
                          fill={`${cluster.color}25`}
                        />
                      )}

                      {/* Node */}
                      <circle
                        cx={x} cy={y} r={r}
                        fill={isMilestone ? cluster.color : `${cluster.color}BB`}
                        stroke={isSelected ? "#ffffff" : isHovered ? cluster.color : "transparent"}
                        strokeWidth={isSelected ? 2 : 1.5}
                        style={{ cursor: "pointer", transition: "all 0.15s" }}
                        fillOpacity={isHovered || isSelected ? 1 : 0.85}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(paper.id);
                          onSelectPaper(paper);
                        }}
                        onMouseEnter={() => setHoveredId(paper.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      />

                      {/* Star icon for milestones */}
                      {isMilestone && (
                        <text
                          x={x} y={y + 3}
                          textAnchor="middle"
                          style={{ fill: "#080C1A", fontSize: `${r * 0.9}px`, fontWeight: 900, pointerEvents: "none" }}
                        >
                          ★
                        </text>
                      )}

                      {/* Label for larger nodes */}
                      {(r >= 14 || isHovered || isSelected) && (
                        <text
                          x={x} y={y - r - 5}
                          textAnchor="middle"
                          style={{
                            fill: isHovered || isSelected ? cluster.color : "rgba(255,255,255,0.6)",
                            fontSize: "9px",
                            fontFamily: "Inter, sans-serif",
                            fontWeight: 600,
                            pointerEvents: "none",
                          }}
                        >
                          {paper.shortTitle}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredId && (() => {
          const p = mockGraphPapers.find((x) => x.id === hoveredId);
          if (!p) return null;
          return (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 glass rounded-xl px-4 py-3 border border-white/[0.1] z-30 max-w-sm pointer-events-none animate-fade-in">
              <p className="text-sm font-semibold text-text-primary">{p.title}</p>
              <p className="text-xs text-text-muted mt-1">
                {p.year} · {p.venue} ·{" "}
                <span className="font-mono" style={{ color: CLUSTER_CONFIGS[p.cluster].color }}>
                  {p.citations.toLocaleString()} 引用
                </span>
              </p>
            </div>
          );
        })()}

        {/* Legend */}
        <div className="absolute bottom-6 right-6 glass rounded-xl p-3 border border-white/[0.08]">
          <p className="text-[10px] text-text-muted mb-2">★ = 里程碑论文（引用 &gt;20k）</p>
          <p className="text-[10px] text-text-muted">节点大小 = 引用数</p>
        </div>
      </div>
    </div>
  );
}
