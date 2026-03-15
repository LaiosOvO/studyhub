'use client';

import { useTranslations } from 'next-intl';
import { usePaperMapStore } from '@/stores/paper-map-store';
import { useGraphData } from './hooks/useGraphData';
import { useFilteredData } from './hooks/useFilteredData';
import { CitationGraph } from './graph/CitationGraph';
import { PaperDetailPanel } from './shared/PaperDetailPanel';

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

  const tabLabels: Record<ActiveView, string> = {
    graph: t('tabs.citationGraph'),
    topic: t('tabs.topicMap'),
    timeline: t('tabs.timeline'),
  };

  return (
    <div className="relative flex h-[calc(100vh-12rem)] flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white">
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

      {/* Main content area */}
      <div className="relative flex-1 overflow-hidden">
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
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">{t('comingSoon')}</p>
          </div>
        )}

        {!isLoading && !error && activeView === 'timeline' && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">{t('comingSoon')}</p>
          </div>
        )}

        {/* Paper detail sidebar */}
        {!isLoading && !error && (
          <PaperDetailPanel nodes={filteredNodes} />
        )}
      </div>
    </div>
  );
}
