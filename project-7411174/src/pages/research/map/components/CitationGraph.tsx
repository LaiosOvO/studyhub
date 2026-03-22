import { useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type NodeTypes,
  type OnConnect,
  BackgroundVariant,
  Position,
  Handle,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  mockGraphPapers,
  mockGraphEdges,
  CLUSTER_CONFIGS,
  getNodeSize,
  type GraphPaper,
  expansionPapers,
} from "../../../../mocks/graph";

// ─── Types ───────────────────────────────────────────────────────
export interface CitationNodeData {
  paper: GraphPaper;
  size: number;
  clusterColor: string;
  isHighlighted: boolean;
  isDimmed: boolean;
  [key: string]: unknown;
}

type CitationNode = Node<CitationNodeData>;
type CitationEdge = Edge;

// ─── Custom Node Component ────────────────────────────────────────
function CitationNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as CitationNodeData;
  const { paper, size, clusterColor, isDimmed } = nodeData;
  const fontSize = size < 55 ? 8 : size < 70 ? 9 : 10;

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: "none" }} />
      <div
        style={{
          width: size,
          height: size,
          backgroundColor: selected ? clusterColor : `${clusterColor}CC`,
          border: `${selected ? 3 : 2}px solid ${selected ? "#ffffff" : `${clusterColor}80`}`,
          boxShadow: selected
            ? `0 0 0 3px ${clusterColor}40, 0 0 20px ${clusterColor}60`
            : `0 0 12px ${clusterColor}30`,
          opacity: isDimmed ? 0.25 : 1,
          transition: "all 0.2s ease",
        }}
        className="rounded-full flex flex-col items-center justify-center overflow-hidden cursor-pointer"
        title={`${paper.title}\n${paper.year} · ${paper.citations.toLocaleString()} citations`}
      >
        <span
          style={{ fontSize, lineHeight: 1.2 }}
          className="text-white font-semibold text-center px-1 leading-tight select-none"
        >
          {paper.shortTitle}
        </span>
        {size >= 55 && (
          <span style={{ fontSize: fontSize - 1 }} className="text-white/60 select-none">
            {paper.year}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: "none" }} />
    </>
  );
}

const nodeTypes: NodeTypes = {
  citation: CitationNodeComponent,
};

// ─── Helpers ──────────────────────────────────────────────────────
const buildNodes = (
  papers: GraphPaper[],
  selectedId: string | null,
  highlightedIds: Set<string>
): CitationNode[] =>
  papers.map((paper) => {
    const size = getNodeSize(paper.citations);
    const clusterColor = CLUSTER_CONFIGS[paper.cluster].color;
    const isHighlighted = highlightedIds.size === 0 || highlightedIds.has(paper.id);
    return {
      id: paper.id,
      type: "citation",
      position: { x: paper.x - size / 2, y: paper.y - size / 2 },
      data: {
        paper,
        size,
        clusterColor,
        isHighlighted,
        isDimmed: highlightedIds.size > 0 && !isHighlighted,
      },
      selected: paper.id === selectedId,
    };
  });

const buildEdges = (edges: typeof mockGraphEdges, highlightedIds: Set<string>): CitationEdge[] =>
  edges.map((e) => {
    const isHighlighted =
      highlightedIds.size === 0 || (highlightedIds.has(e.source) && highlightedIds.has(e.target));
    const sourceCluster = mockGraphPapers.find((p) => p.id === e.source)?.cluster ?? 0;
    const color = CLUSTER_CONFIGS[sourceCluster].color;
    return {
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: "default",
      animated: false,
      style: {
        stroke: isHighlighted ? `${color}90` : `${color}20`,
        strokeWidth: isHighlighted ? 1.5 : 1,
        transition: "all 0.2s",
      },
      markerEnd: {
        type: "arrowclosed" as const,
        color: isHighlighted ? `${color}80` : `${color}20`,
        width: 12,
        height: 12,
      },
    };
  });

// ─── Get connected paper IDs ──────────────────────────────────────
function getConnectedIds(paperId: string): Set<string> {
  const ids = new Set<string>([paperId]);
  mockGraphEdges.forEach((e) => {
    if (e.source === paperId) ids.add(e.target);
    if (e.target === paperId) ids.add(e.source);
  });
  return ids;
}

// ─── Props ────────────────────────────────────────────────────────
interface CitationGraphProps {
  papers?: GraphPaper[];
  edges?: { source: string; target: string }[];
  onSelectPaper: (paper: GraphPaper | null) => void;
  yearRange: [number, number];
  minCitations: number;
  activeCluster: number | null;
}

// ─── Main Component ───────────────────────────────────────────────
export default function CitationGraph({
  papers: papersProp,
  edges: edgesProp,
  onSelectPaper,
  yearRange,
  minCitations,
  activeCluster,
}: CitationGraphProps) {
  const [allPapers, setAllPapers] = useState<GraphPaper[]>(papersProp ?? mockGraphPapers);
  const [allEdgeData, setAllEdgeData] = useState(edgesProp ?? mockGraphEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [expandingId, setExpandingId] = useState<string | null>(null);

  // Update data when props change
  useEffect(() => {
    if (papersProp) setAllPapers(papersProp);
  }, [papersProp]);
  useEffect(() => {
    if (edgesProp) setAllEdgeData(edgesProp);
  }, [edgesProp]);

  // Filter papers based on toolbar state
  const filteredPapers = allPapers.filter((p) => {
    if (p.year < yearRange[0] || p.year > yearRange[1]) return false;
    if (p.citations < minCitations) return false;
    if (activeCluster !== null && p.cluster !== activeCluster) return false;
    return true;
  });

  const filteredPaperIds = new Set(filteredPapers.map((p) => p.id));
  const filteredEdges = allEdgeData.filter(
    (e) => filteredPaperIds.has(e.source) && filteredPaperIds.has(e.target)
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<CitationNode>(
    buildNodes(filteredPapers, selectedId, highlightedIds)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<CitationEdge>(
    buildEdges(filteredEdges, highlightedIds)
  );

  // Sync when filters or selections change
  useEffect(() => {
    setNodes(buildNodes(filteredPapers, selectedId, highlightedIds));
    setEdges(buildEdges(filteredEdges, highlightedIds));
  }, [allPapers, allEdgeData, selectedId, highlightedIds, yearRange, minCitations, activeCluster]);

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const paper = allPapers.find((p) => p.id === node.id);
      if (!paper) return;
      if (selectedId === node.id) {
        setSelectedId(null);
        setHighlightedIds(new Set());
        onSelectPaper(null);
      } else {
        setSelectedId(node.id);
        setHighlightedIds(getConnectedIds(node.id));
        onSelectPaper(paper);
      }
    },
    [allPapers, selectedId, onSelectPaper]
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (expandingId === node.id) return;
      const newPapers = expansionPapers[node.id];
      if (!newPapers) return;

      setExpandingId(node.id);
      const existingIds = new Set(allPapers.map((p) => p.id));
      const toAdd = newPapers.filter((p) => !existingIds.has(p.id));

      // Offset new nodes relative to the clicked node
      const sourcePaper = allPapers.find((p) => p.id === node.id);
      if (!sourcePaper) return;

      const offsetPapers: GraphPaper[] = toAdd.map((p, i) => ({
        ...p,
        x: sourcePaper.x + (i % 2 === 0 ? 180 : -180),
        y: sourcePaper.y + (i < 2 ? -160 : 160) * (Math.floor(i / 2) + 1),
      }));

      const newEdges = offsetPapers.map((p) => ({ source: p.id, target: node.id }));

      setTimeout(() => {
        setAllPapers((prev) => [...prev, ...offsetPapers]);
        setAllEdgeData((prev) => [...prev, ...newEdges]);
        setExpandingId(null);
      }, 300);
    },
    [allPapers, allEdgeData, expandingId]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedId(null);
    setHighlightedIds(new Set());
    onSelectPaper(null);
  }, [onSelectPaper]);

  return (
    <div className="w-full h-full relative bg-bg-primary">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        nodeOrigin={[0.5, 0.5]}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        defaultEdgeOptions={{ type: "default" }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={3}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={32}
          size={1.2}
          color="rgba(255,255,255,0.06)"
        />
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap
          position="bottom-left"
          nodeColor={(n) => {
            const paper = allPapers.find((p) => p.id === n.id);
            if (!paper) return "#1A2238";
            return `${CLUSTER_CONFIGS[paper.cluster].color}80`;
          }}
          nodeStrokeWidth={0}
          pannable
          zoomable
          style={{ width: 140, height: 90 }}
        />
      </ReactFlow>

      {/* Cluster Legend */}
      <div className="absolute top-4 left-4 glass rounded-xl p-3 border border-white/[0.08] space-y-1.5 z-10">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">研究方向</p>
        {CLUSTER_CONFIGS.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
            <span className="text-[11px] text-text-secondary whitespace-nowrap">{c.name}</span>
          </div>
        ))}
      </div>

      {/* Expanding indicator */}
      {expandingId && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glass rounded-xl px-4 py-2.5 border border-accent-cyan/30 z-20 flex items-center gap-2 animate-fade-in">
          <i className="ri-loader-4-line animate-spin text-accent-cyan" />
          <span className="text-sm text-accent-cyan font-medium">正在扩展引用网络...</span>
        </div>
      )}

      {/* Double-click hint */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/[0.08] z-10 backdrop-blur-sm pointer-events-none">
        <i className="ri-mouse-line text-text-muted text-xs" />
        <span className="text-[10px] text-text-muted">双击节点扩展引用网络 · 单击查看详情</span>
      </div>
    </div>
  );
}
