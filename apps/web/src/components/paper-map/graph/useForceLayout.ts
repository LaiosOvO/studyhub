'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import type { Node, Edge } from '@xyflow/react';
import type { PaperNodeData } from '@/lib/graph-transforms';

interface ForceNode extends SimulationNodeDatum {
  readonly id: string;
  readonly citationCount: number;
}

interface UseForceLayoutOptions {
  readonly initialNodes: Node<PaperNodeData>[];
  readonly initialEdges: Edge[];
  readonly setNodes: (updater: (nodes: Node<PaperNodeData>[]) => Node<PaperNodeData>[]) => void;
}

function nodeRadius(citationCount: number): number {
  return Math.max(15, Math.min(40, Math.sqrt(citationCount) * 2.5));
}

/**
 * D3 force simulation hook that positions React Flow nodes.
 * Updates node positions via setNodes callback.
 * Only calls setNodes every 3rd tick to reduce jank with 200+ nodes.
 */
export function useForceLayout({
  initialNodes,
  initialEdges,
  setNodes,
}: UseForceLayoutOptions): void {
  const simulationRef = useRef<ReturnType<typeof forceSimulation<ForceNode>> | null>(null);
  const nodesVersionRef = useRef(0);

  // Track version by node count + edge count to avoid unnecessary restarts
  const version = `${initialNodes.length}-${initialEdges.length}`;
  const versionRef = useRef(version);

  const stableSetNodes = useCallback(setNodes, [setNodes]);

  useEffect(() => {
    if (initialNodes.length === 0) return;

    // Skip if version hasn't changed
    if (versionRef.current === version && simulationRef.current) return;
    versionRef.current = version;

    // Stop previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const forceNodes: ForceNode[] = initialNodes.map((node) => ({
      id: node.id,
      x: node.position.x || Math.random() * 500,
      y: node.position.y || Math.random() * 500,
      citationCount: (node.data as PaperNodeData).citationCount,
    }));

    const nodeIdSet = new Set(forceNodes.map((n) => n.id));

    const forceLinks: SimulationLinkDatum<ForceNode>[] = initialEdges
      .filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
      }));

    let tickCounter = 0;

    const simulation = forceSimulation<ForceNode>(forceNodes)
      .force(
        'link',
        forceLink<ForceNode, SimulationLinkDatum<ForceNode>>(forceLinks)
          .id((d) => d.id)
          .distance(100),
      )
      .force('charge', forceManyBody<ForceNode>().strength(-300))
      .force('center', forceCenter(0, 0))
      .force(
        'collide',
        forceCollide<ForceNode>().radius((d) => nodeRadius(d.citationCount)),
      )
      .on('tick', () => {
        tickCounter++;
        // Only update every 3rd tick to reduce render pressure
        if (tickCounter % 3 !== 0) return;

        const positionMap = new Map<string, { x: number; y: number }>();
        for (const node of forceNodes) {
          positionMap.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
        }

        stableSetNodes((prev) =>
          prev.map((node) => {
            const pos = positionMap.get(node.id);
            if (!pos) return node;
            return { ...node, position: { x: pos.x, y: pos.y } };
          }),
        );
      });

    simulationRef.current = simulation;
    nodesVersionRef.current++;

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [initialNodes, initialEdges, version, stableSetNodes]);
}
