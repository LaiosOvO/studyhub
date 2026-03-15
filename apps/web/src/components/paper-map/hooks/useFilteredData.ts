'use client';

import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { usePaperMapStore } from '@/stores/paper-map-store';
import type { PaperNodeData } from '@/lib/graph-transforms';

interface UseFilteredDataResult {
  readonly nodes: Node<PaperNodeData>[];
  readonly edges: Edge[];
}

/**
 * Applies client-side filters from the Zustand store to nodes and edges.
 * All filtering is immutable -- returns new arrays.
 */
export function useFilteredData(
  nodes: Node<PaperNodeData>[],
  edges: Edge[],
): UseFilteredDataResult {
  const filters = usePaperMapStore((state) => state.filters);

  return useMemo(() => {
    const filteredNodes = nodes.filter((node) => {
      const data = node.data;

      // Year range filter
      if (filters.yearRange !== null) {
        const [minYear, maxYear] = filters.yearRange;
        if (data.year < minYear || data.year > maxYear) {
          return false;
        }
      }

      // Quality threshold filter
      if (data.qualityScore < filters.qualityThreshold) {
        return false;
      }

      // Method types filter
      if (filters.methodTypes.length > 0) {
        const hasMatchingMethod = data.methods.some((method) =>
          filters.methodTypes.includes(method),
        );
        if (!hasMatchingMethod) {
          return false;
        }
      }

      return true;
    });

    // Build a set of visible node IDs for fast edge filtering
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));

    const filteredEdges = edges.filter(
      (edge) =>
        visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [nodes, edges, filters]);
}
