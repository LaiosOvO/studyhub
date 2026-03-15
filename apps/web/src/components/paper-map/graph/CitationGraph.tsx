'use client';

import { useCallback } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  Background,
  Controls,
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Node, Edge } from '@xyflow/react';
import { useEffect } from 'react';
import { PaperNode } from './PaperNode';
import { useForceLayout } from './useForceLayout';
import { usePaperMapStore } from '@/stores/paper-map-store';
import type { PaperNodeData } from '@/lib/graph-transforms';

// CRITICAL: Define nodeTypes OUTSIDE the component to prevent React Flow re-mount bug
const nodeTypes = { paper: PaperNode };

interface CitationGraphProps {
  readonly initialNodes: Node<PaperNodeData>[];
  readonly initialEdges: Edge[];
}

export function CitationGraph({ initialNodes, initialEdges }: CitationGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PaperNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const selectPaper = usePaperMapStore((state) => state.selectPaper);

  // Sync initial data into React Flow state
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Apply D3 force layout
  useForceLayout({
    initialNodes,
    initialEdges,
    setNodes: setNodes as (updater: (nodes: Node<PaperNodeData>[]) => Node<PaperNodeData>[]) => void,
  });

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      selectPaper(node.id);
    },
    [selectPaper],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as unknown as PaperNodeData;
            return data?.clusterId === 'default' ? '#4e79a7' : '#76b7b2';
          }}
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>
    </div>
  );
}
