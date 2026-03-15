'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { schemeTableau10 } from 'd3-scale-chromatic';
import type { PaperNodeData } from '@/lib/graph-transforms';

function clusterColor(clusterId: string): string {
  // Hash the cluster ID to an index in the Tableau10 palette
  if (clusterId === 'default') return schemeTableau10[0];
  let hash = 0;
  for (let i = 0; i < clusterId.length; i++) {
    hash = (hash * 31 + clusterId.charCodeAt(i)) | 0;
  }
  return schemeTableau10[Math.abs(hash) % schemeTableau10.length];
}

function nodeSize(citationCount: number): number {
  return Math.max(30, Math.min(80, Math.sqrt(citationCount) * 5));
}

function PaperNodeComponent({ data }: NodeProps) {
  const paperData = data as unknown as PaperNodeData;
  const size = nodeSize(paperData.citationCount);
  const color = clusterColor(paperData.clusterId);

  return (
    <div
      title={paperData.title}
      className="flex cursor-pointer items-center justify-center rounded-full border-2 border-white/50 font-semibold text-white shadow-md transition-shadow hover:shadow-lg"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: Math.max(10, size / 4),
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!invisible"
      />
      {paperData.citationCount}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!invisible"
      />
    </div>
  );
}

export const PaperNode = memo(PaperNodeComponent);
