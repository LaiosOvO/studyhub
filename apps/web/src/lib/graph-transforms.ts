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

// --- Deck.gl point stub (Plan 02) ---

export interface DeckGlPoint {
  readonly paperId: string;
  readonly title: string;
  readonly x: number;
  readonly y: number;
  readonly citationCount: number;
  readonly year: number;
}

// --- Timeline item stub (Plan 02) ---

export interface TimelineItem {
  readonly id: string;
  readonly content: string;
  readonly start: string;
  readonly group?: string;
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
 * Stub for Deck.gl point transform (Plan 02).
 */
export function toDeckGlPoints(apiResponse: GraphApiResponse): readonly DeckGlPoint[] {
  return apiResponse.nodes.map((node) => ({
    paperId: node.paper_id,
    title: node.title,
    x: 0,
    y: 0,
    citationCount: node.citation_count,
    year: node.year,
  }));
}

/**
 * Stub for vis-timeline item transform (Plan 02).
 */
export function toTimelineItems(apiResponse: GraphApiResponse): readonly TimelineItem[] {
  return apiResponse.nodes.map((node) => ({
    id: node.paper_id,
    content: node.title,
    start: `${node.year}-01-01`,
    group: node.cluster_id ?? 'default',
  }));
}
