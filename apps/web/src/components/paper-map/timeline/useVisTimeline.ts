'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePaperMapStore } from '@/stores/paper-map-store';
import type { TimelineItem } from '@/lib/graph-transforms';

// One year in milliseconds
const ONE_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

interface UseVisTimelineOptions {
  readonly items: readonly TimelineItem[];
}

/**
 * Custom hook that manages a vis-timeline instance.
 *
 * Creates the timeline on mount, updates items reactively,
 * and wires the select event to the shared paper store.
 * Cleans up via timeline.destroy() on unmount.
 */
export function useVisTimeline(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { items }: UseVisTimelineOptions,
) {
  const timelineRef = useRef<InstanceType<typeof import('vis-timeline/standalone').Timeline> | null>(null);
  const selectPaper = usePaperMapStore((s) => s.selectPaper);

  const handleSelect = useCallback(
    (props: { items: (string | number)[] }) => {
      const selectedId = props.items[0];
      if (typeof selectedId === 'string') {
        selectPaper(selectedId);
      }
    },
    [selectPaper],
  );

  // Initialize timeline
  useEffect(() => {
    const container = containerRef.current;
    if (!container || items.length === 0) return;

    let destroyed = false;

    async function init() {
      const { Timeline, DataSet } = await import('vis-timeline/standalone');

      if (destroyed || !container) return;

      const dataset = new DataSet(
        items.map((item) => ({
          id: item.id,
          content: item.content,
          start: item.start,
          group: item.group,
          className: item.className,
        })),
      );

      const timeline = new Timeline(container, dataset, {
        zoomMin: ONE_YEAR_MS,
        zoomMax: ONE_YEAR_MS * 50,
        stack: true,
        showCurrentTime: false,
        height: '100%',
        margin: { item: 10 },
      });

      timeline.on('select', handleSelect);
      timelineRef.current = timeline;
    }

    init();

    return () => {
      destroyed = true;
      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
      }
    };
  }, [containerRef, items, handleSelect]);

  // Update items when they change (after initial mount)
  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline || items.length === 0) return;

    async function updateItems() {
      const { DataSet } = await import('vis-timeline/standalone');

      const dataset = new DataSet(
        items.map((item) => ({
          id: item.id,
          content: item.content,
          start: item.start,
          group: item.group,
          className: item.className,
        })),
      );

      timeline!.setItems(dataset);
    }

    updateItems();
  }, [items]);
}
