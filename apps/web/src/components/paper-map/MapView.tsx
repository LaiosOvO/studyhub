'use client';

import { useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { usePaperMapStore } from '@/stores/paper-map-store';
import { useGraphData } from './hooks/useGraphData';
import { useFilteredData } from './hooks/useFilteredData';
import { CitationGraph } from './graph/CitationGraph';
import { PaperDetailPanel } from './shared/PaperDetailPanel';
import { FilterBar } from './shared/FilterBar';
import { ExportMenu } from './shared/ExportMenu';
import { ReadingListDrawer } from './shared/ReadingListDrawer';

const TopicMap = dynamic(
  () => import('./topic-map/TopicMap').then((m) => ({ default: m.TopicMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    ),
  },
);

const TimelineView = dynamic(
  () => import('./timeline/TimelineView').then((m) => ({ default: m.TimelineView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    ),
  },
);

type ActiveView = 'graph' | 'topic' | 'timeline';

const VIEW_TABS: readonly ActiveView[] = ['graph', 'topic', 'timeline'];

interface MapViewProps {
  readonly taskId: string;
}

export function MapView({ taskId }: MapViewProps) {
  const t = useTranslations('paperMap');
  const activeView = usePaperMapStore((state) => state.activeView);
  const setActiveView = usePaperMapStore((state) => state.setActiveView);

  const { nodes: rawNodes, edges: rawEdges, isLoading, error } = useGraphData(taskId);
  const { nodes: filteredNodes, edges: filteredEdges } = useFilteredData(rawNodes, rawEdges);

  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [isReadingListOpen, setIsReadingListOpen] = useState(false);

  const toggleReadingList = useCallback(() => {
    setIsReadingListOpen((prev) => !prev);
  }, []);

  const closeReadingList = useCallback(() => {
    setIsReadingListOpen(false);
  }, []);

  const tabLabels: Record<ActiveView, string> = {
    graph: t('tabs.citationGraph'),
    topic: t('tabs.topicMap'),
    timeline: t('tabs.timeline'),
  };

  return (
    <div className="relative flex h-[calc(100vh-12rem)] flex-col">
      {/* Filter bar */}
      <FilterBar nodes={rawNodes} />

      {/* Tab bar with toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white">
        <div className="flex">
          {VIEW_TABS.map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeView === view
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tabLabels[view]}
            </button>
          ))}
        </div>

        {/* Toolbar: Export + Reading List toggle */}
        <div className="flex items-center gap-2 pr-4">
          <ExportMenu
            nodes={filteredNodes}
            edges={filteredEdges}
            graphContainerRef={graphContainerRef}
          />
          <button
            onClick={toggleReadingList}
            className={`flex items-center gap-1 rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
              isReadingListOpen
                ? 'border-blue-500 bg-blue-50 text-blue-600'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            {t('readingList.title')}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div ref={graphContainerRef} className="relative flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-500">{t('loading')}</p>
          </div>
        )}

        {error && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-red-500">{t('error')}: {error}</p>
          </div>
        )}

        {!isLoading && !error && activeView === 'graph' && (
          <CitationGraph
            initialNodes={filteredNodes}
            initialEdges={filteredEdges}
          />
        )}

        {!isLoading && !error && activeView === 'topic' && (
          <TopicMap taskId={taskId} nodes={filteredNodes} />
        )}

        {!isLoading && !error && activeView === 'timeline' && (
          <TimelineView nodes={filteredNodes} />
        )}

        {/* Paper detail sidebar */}
        {!isLoading && !error && (
          <PaperDetailPanel nodes={filteredNodes} />
        )}

        {/* Reading list drawer */}
        <ReadingListDrawer
          isOpen={isReadingListOpen}
          onClose={closeReadingList}
          nodes={filteredNodes}
        />
      </div>
    </div>
  );
}
