'use client';

import dynamic from 'next/dynamic';
import type { Node } from '@xyflow/react';
import type { PaperNodeData } from '@/lib/graph-transforms';

const TimelineViewInner = dynamic(() => import('./TimelineViewInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>
  ),
});

interface TimelineViewProps {
  readonly nodes: readonly Node<PaperNodeData>[];
}

export function TimelineView({ nodes }: TimelineViewProps) {
  return <TimelineViewInner nodes={nodes} />;
}
