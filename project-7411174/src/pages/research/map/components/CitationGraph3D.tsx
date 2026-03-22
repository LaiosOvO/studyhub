import { useCallback, useMemo, useRef, useState } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import {
  CLUSTER_CONFIGS as DEFAULT_CLUSTER_CONFIGS,
  type GraphPaper,
  type GraphEdge,
} from '../../../../mocks/graph';

// ─── Types ────────────────────────────────────────────────────────
interface ClusterConfig {
  id: number;
  name: string;
  color: string;
}

interface GraphNode {
  id: string;
  paper: GraphPaper;
  color: string;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
  color: string;
}

interface Props {
  papers?: GraphPaper[];
  edges?: GraphEdge[];
  clusterConfigs?: ClusterConfig[];
  onSelectPaper: (paper: GraphPaper | null) => void;
  yearRange: [number, number];
  minCitations: number;
  activeCluster: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────
const SPHERE_GEO = new THREE.SphereGeometry(1, 20, 20);

function createNodeObject(node: GraphNode): THREE.Object3D {
  const group = new THREE.Group();
  const r = node.val;

  // Core sphere with emissive glow
  const core = new THREE.Mesh(
    SPHERE_GEO,
    new THREE.MeshStandardMaterial({
      color: node.color,
      emissive: node.color,
      emissiveIntensity: 0.55,
      metalness: 0.25,
      roughness: 0.45,
    }),
  );
  core.scale.setScalar(r);
  group.add(core);

  // Outer glow (backside, additive)
  const glow = new THREE.Mesh(
    SPHERE_GEO,
    new THREE.MeshBasicMaterial({
      color: node.color,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    }),
  );
  glow.scale.setScalar(r * 2.4);
  group.add(glow);

  return group;
}

// ─── Component ────────────────────────────────────────────────────
export default function CitationGraph3D({
  papers: papersProp,
  edges: edgesProp,
  clusterConfigs,
  onSelectPaper,
  yearRange,
  minCitations,
  activeCluster,
}: Props) {
  const graphRef = useRef<ForceGraphMethods | undefined>();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; paper: GraphPaper } | null>(null);

  const clusters = clusterConfigs ?? DEFAULT_CLUSTER_CONFIGS;
  const clusterColorMap = useMemo(
    () => new Map(clusters.map(c => [c.id, c.color])),
    [clusters],
  );

  // Filter papers
  const filteredPapers = useMemo(() => {
    const all = papersProp ?? [];
    return all.filter(
      p =>
        p.year >= yearRange[0] &&
        p.year <= yearRange[1] &&
        p.citations >= minCitations &&
        (activeCluster === null || p.cluster === activeCluster),
    );
  }, [papersProp, yearRange, minCitations, activeCluster]);

  const filteredIds = useMemo(() => new Set(filteredPapers.map(p => p.id)), [filteredPapers]);

  // Build graph data
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = filteredPapers.map(paper => ({
      id: paper.id,
      paper,
      color: clusterColorMap.get(paper.cluster) ?? '#00D4B8',
      val: Math.log2(paper.citations + 1) * 2.5 + 3,
    }));

    const allEdges = edgesProp ?? [];
    const links: GraphLink[] = allEdges
      .filter(e => filteredIds.has(e.source) && filteredIds.has(e.target))
      .map(e => ({
        source: e.source,
        target: e.target,
        color: `${clusterColorMap.get(
          filteredPapers.find(p => p.id === e.source)?.cluster ?? 0,
        ) ?? '#00D4B8'}30`,
      }));

    return { nodes, links };
  }, [filteredPapers, filteredIds, edgesProp, clusterColorMap]);

  // Callbacks
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onSelectPaper(node.paper);
    },
    [onSelectPaper],
  );

  const handleBackgroundClick = useCallback(() => {
    onSelectPaper(null);
  }, [onSelectPaper]);

  const handleNodeHover = useCallback(
    (node: GraphNode | null, prevNode: GraphNode | null) => {
      // Restore previous node
      if (prevNode?.__threeObj) {
        const group = prevNode.__threeObj as THREE.Group;
        const core = group.children[0] as THREE.Mesh;
        const glow = group.children[1] as THREE.Mesh;
        if (core) core.scale.setScalar(prevNode.val);
        if (glow) glow.scale.setScalar(prevNode.val * 2.4);
        const glowMat = glow?.material as THREE.MeshBasicMaterial;
        if (glowMat) glowMat.opacity = 0.09;
      }

      // Highlight current node
      if (node?.__threeObj) {
        const group = node.__threeObj as THREE.Group;
        const core = group.children[0] as THREE.Mesh;
        const glow = group.children[1] as THREE.Mesh;
        if (core) core.scale.setScalar(node.val * 1.25);
        if (glow) glow.scale.setScalar(node.val * 3.2);
        const glowMat = glow?.material as THREE.MeshBasicMaterial;
        if (glowMat) glowMat.opacity = 0.16;
      }

      if (node) {
        setTooltip(prev => ({
          x: prev?.x ?? 0,
          y: prev?.y ?? 0,
          paper: node.paper,
        }));
      } else {
        setTooltip(null);
      }
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (tooltip) {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip(prev =>
          prev
            ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }
            : null,
        );
      }
    },
    [tooltip],
  );

  const nodeThreeObject = useCallback((node: GraphNode) => createNodeObject(node), []);

  // Configure force engine after mount for proper node spacing
  const handleEngineInit = useCallback((fg: ForceGraphMethods | null) => {
    graphRef.current = fg;
    if (!fg) return;
    // Increase charge repulsion to spread nodes apart
    fg.d3Force('charge')?.strength(-250);
    // Increase link distance so connected nodes aren't too close
    fg.d3Force('link')?.distance(80);
    // Center force
    fg.d3Force('center')?.strength(0.05);
  }, []);

  return (
    <div className="w-full h-full relative select-none" style={{ background: '#050A18' }} onPointerMove={handlePointerMove}>
      <ForceGraph3D
        ref={handleEngineInit}
        graphData={graphData}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={handleBackgroundClick}
        linkCurvature={0.15}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={0.9}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.5}
        linkColor={(link: GraphLink) => link.color}
        linkOpacity={0.3}
        backgroundColor="#050A18"
        warmupTicks={100}
        cooldownTime={5000}
        enableNavigationControls
      />

      {/* Cluster Legend */}
      <div
        className="absolute top-4 left-4 rounded-xl p-3 border border-white/[0.08] space-y-1.5 z-10"
        style={{ background: 'rgba(5,10,24,0.85)', backdropFilter: 'blur(14px)' }}
      >
        <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">研究方向</p>
        {clusters.map(c => (
          <div key={c.id} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: c.color, boxShadow: `0 0 7px ${c.color}` }}
            />
            <span className="text-[11px] text-white/55 whitespace-nowrap">{c.name}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none rounded-xl px-3 py-2.5 border border-white/[0.12]"
          style={{
            left: Math.min(tooltip.x + 18, window.innerWidth - 260),
            top: tooltip.y - 8,
            background: 'rgba(5,10,24,0.94)',
            backdropFilter: 'blur(16px)',
            maxWidth: 240,
          }}
        >
          <p className="text-xs text-white font-semibold leading-snug mb-1">{tooltip.paper.title}</p>
          <div className="flex items-center gap-2 text-[10px] text-white/45">
            <span>{tooltip.paper.year}</span>
            <span>·</span>
            <span>{tooltip.paper.citations.toLocaleString()} 引用</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: clusterColorMap.get(tooltip.paper.cluster) ?? '#00D4B8' }}
            />
            <span
              className="text-[10px]"
              style={{ color: clusterColorMap.get(tooltip.paper.cluster) ?? '#00D4B8' }}
            >
              {clusters.find(c => c.id === tooltip.paper.cluster)?.name ?? '未知'}
            </span>
          </div>
        </div>
      )}

      {/* Hint bar */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.08] z-10 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
      >
        <i className="ri-3d-rotation-line text-white/35 text-xs" />
        <span className="text-[10px] text-white/35 whitespace-nowrap">拖动旋转 · 滚轮缩放 · 点击查看论文详情</span>
      </div>
    </div>
  );
}
