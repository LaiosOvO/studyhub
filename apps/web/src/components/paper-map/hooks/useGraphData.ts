'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { apiFetch } from '@/lib/api';
import {
  toReactFlowGraph,
  type GraphApiResponse,
  type PaperNodeData,
} from '@/lib/graph-transforms';

interface DeepResearchTask {
  readonly id: string;
  readonly user_id: string;
  readonly workflow_id: string;
  readonly research_direction: string;
  readonly entry_type: string;
  readonly status: string;
  readonly papers_found: number;
  readonly papers_analyzed: number;
  readonly total_cost: number;
  readonly created_at: string | null;
  readonly completed_at: string | null;
  readonly seed_paper_ids?: readonly string[];
}

interface UseGraphDataResult {
  readonly nodes: Node<PaperNodeData>[];
  readonly edges: Edge[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

export function useGraphData(taskId: string): UseGraphDataResult {
  const [nodes, setNodes] = useState<Node<PaperNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rawResponseRef = useRef<GraphApiResponse | null>(null);
  const [fetchVersion, setFetchVersion] = useState(0);

  const refetch = useCallback(() => {
    setFetchVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Fetch task detail to get seed paper IDs
        const taskResult = await apiFetch<DeepResearchTask>(
          `/api/v1/deep-research/tasks/${taskId}`,
        );

        if (cancelled) return;

        if (!taskResult.success) {
          setError(taskResult.error ?? 'Failed to load research task');
          setIsLoading(false);
          return;
        }

        const seedPaperIds = taskResult.data.seed_paper_ids;
        if (!seedPaperIds || seedPaperIds.length === 0) {
          setError('No seed papers found for this research task');
          setIsLoading(false);
          return;
        }

        // Step 2: Fetch graph neighborhood for the first seed paper
        const graphResult = await apiFetch<GraphApiResponse>(
          `/citations/graph/${seedPaperIds[0]}?depth=2`,
        );

        if (cancelled) return;

        if (!graphResult.success) {
          setError(graphResult.error ?? 'Failed to load citation graph');
          setIsLoading(false);
          return;
        }

        rawResponseRef.current = graphResult.data;

        const { nodes: flowNodes, edges: flowEdges } = toReactFlowGraph(
          graphResult.data,
        );

        setNodes(flowNodes);
        setEdges(flowEdges);
        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Unknown error loading graph',
          );
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [taskId, fetchVersion]);

  return { nodes, edges, isLoading, error, refetch };
}
