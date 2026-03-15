import type { Node, Edge } from '@xyflow/react';

// --- API response types ---

interface ApiGraphNode {
  readonly paper_id: string;
  readonly title: string;
  readonly citation_count: number;
  readonly year: number;
  readonly quality_score: number;
  readonly cluster_id?: string;
  readonly methods?: readonly string[];
  readonly abstract?: string;
}

interface ApiGraphEdge {
  readonly 0: string; // from_id
  readonly 1: string; // to_id
  readonly 2: string; // type: "CITES" | "RELATED_TO"
}

export interface GraphApiResponse {
  readonly nodes: readonly ApiGraphNode[];
  readonly edges: readonly (readonly [string, string, string])[];
}

// --- React Flow node data ---

export interface PaperNodeData {
  readonly label: string;
  readonly title: string;
  readonly citationCount: number;
  readonly qualityScore: number;
  readonly year: number;
  readonly clusterId: string;
  readonly methods: readonly string[];
  readonly abstract: string;
  [key: string]: unknown;
}

// --- Deck.gl point types ---

export interface EmbeddingPoint {
  readonly paper_id: string;
  readonly x: number;
  readonly y: number;
  readonly cluster_id: number;
  readonly cluster_label: string;
}

export interface DeckGlPoint {
  readonly id: string;
  readonly position: readonly [number, number];
  readonly citationCount: number;
  readonly clusterId: number;
  readonly clusterLabel: string;
  readonly title: string;
  readonly year: number;
}

// --- Timeline item types ---

export interface TimelineItem {
  readonly id: string;
  readonly content: string;
  readonly start: Date;
  readonly group?: number;
  readonly className?: string;
}

/**
 * Transform API graph response into React Flow nodes and edges.
 * Pure function -- no side effects, no mutation.
 */
export function toReactFlowGraph(apiResponse: GraphApiResponse): {
  readonly nodes: Node<PaperNodeData>[];
  readonly edges: Edge[];
} {
  const nodes: Node<PaperNodeData>[] = apiResponse.nodes.map((node) => ({
    id: node.paper_id,
    type: 'paper',
    position: { x: 0, y: 0 },
    data: {
      label: node.title,
      title: node.title,
      citationCount: node.citation_count,
      qualityScore: node.quality_score,
      year: node.year,
      clusterId: node.cluster_id ?? 'default',
      methods: node.methods ?? [],
      abstract: node.abstract ?? '',
    },
  }));

  const edges: Edge[] = apiResponse.edges.map((edge, index) => {
    const [fromId, toId, edgeType] = edge;
    const isCites = edgeType === 'CITES';

    return {
      id: `e-${fromId}-${toId}-${index}`,
      source: fromId,
      target: toId,
      style: {
        stroke: isCites ? '#6b7280' : '#d97706',
        strokeDasharray: isCites ? undefined : '5,5',
      },
      animated: !isCites,
    };
  });

  return { nodes, edges };
}

/**
 * Transform embedding API response into Deck.gl scatter points.
 * Maps backend 2D coordinates to position arrays for ScatterplotLayer.
 */
export function toDeckGlPoints(
  embeddings: readonly EmbeddingPoint[],
  nodes: readonly Node<PaperNodeData>[],
): readonly DeckGlPoint[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n.data]));

  return embeddings.map((emb) => {
    const nodeData = nodeMap.get(emb.paper_id);
    return {
      id: emb.paper_id,
      position: [emb.x, emb.y] as const,
      citationCount: nodeData?.citationCount ?? 1,
      clusterId: emb.cluster_id,
      clusterLabel: emb.cluster_label,
      title: nodeData?.title ?? emb.paper_id,
      year: nodeData?.year ?? 0,
    };
  });
}

/**
 * Transform React Flow nodes into vis-timeline items.
 * Papers without a year are excluded (cannot place on timeline).
 */
export function toTimelineItems(
  nodes: readonly Node<PaperNodeData>[],
): readonly TimelineItem[] {
  return nodes
    .filter((n) => n.data.year > 0)
    .map((n) => {
      const title = n.data.title;
      const truncated = title.length > 60 ? `${title.slice(0, 57)}...` : title;
      const qs = n.data.qualityScore;
      const className =
        qs >= 0.7 ? 'quality-high' : qs >= 0.4 ? 'quality-med' : 'quality-low';

      return {
        id: n.id,
        content: truncated,
        start: new Date(n.data.year, 0, 1),
        group: n.data.clusterId ? parseInt(n.data.clusterId, 10) || 0 : 0,
        className,
      };
    });
}
