'use client';

import { useRef, useMemo } from 'react';
import type { Node } from '@xyflow/react';
import { toTimelineItems, type PaperNodeData } from '@/lib/graph-transforms';
import { useVisTimeline } from './useVisTimeline';
import 'vis-timeline/styles/vis-timeline-graph2d.min.css';

interface TimelineViewInnerProps {
  readonly nodes: readonly Node<PaperNodeData>[];
}

export default function TimelineViewInner({ nodes }: TimelineViewInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => toTimelineItems(nodes), [nodes]);

  useVisTimeline(containerRef, { items });

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-400">No papers with year data available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[400px] w-full rounded-lg border border-gray-200 bg-white"
    />
  );
}
