'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { apiFetch } from '@/lib/api';
import { toDeckGlPoints, type DeckGlPoint, type EmbeddingPoint } from '@/lib/graph-transforms';
import { usePaperMapStore } from '@/stores/paper-map-store';
import type { Node } from '@xyflow/react';
import type { PaperNodeData } from '@/lib/graph-transforms';

// Tableau10-inspired color palette for clusters
const CLUSTER_COLORS: readonly (readonly [number, number, number])[] = [
  [31, 119, 180],
  [255, 127, 14],
  [44, 160, 44],
  [214, 39, 40],
  [148, 103, 189],
  [140, 86, 75],
  [227, 119, 194],
  [127, 127, 127],
  [188, 189, 34],
  [23, 190, 207],
];

interface TopicMapInnerProps {
  readonly taskId: string;
  readonly nodes: readonly Node<PaperNodeData>[];
}

interface ClusterCentroid {
  readonly label: string;
  readonly position: readonly [number, number];
}

export default function TopicMapInner({ taskId, nodes }: TopicMapInnerProps) {
  const [points, setPoints] = useState<readonly DeckGlPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectPaper = usePaperMapStore((s) => s.selectPaper);

  useEffect(() => {
    let cancelled = false;

    async function fetchEmbeddings() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiFetch<EmbeddingPoint[]>(
          `/api/v1/deep-research/tasks/${taskId}/embeddings`,
        );

        if (cancelled) return;

        if (!result.success) {
          setError(result.error ?? 'Failed to load embeddings');
          setIsLoading(false);
          return;
        }

        const deckPoints = toDeckGlPoints(result.data, nodes);
        setPoints(deckPoints);
        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    }

    fetchEmbeddings();
    return () => { cancelled = true; };
  }, [taskId, nodes]);

  const handleClick = useCallback(
    (info: { object?: DeckGlPoint }) => {
      if (info.object) {
        selectPaper(info.object.id);
      }
    },
    [selectPaper],
  );

  // Compute cluster centroids for labels
  const centroids = useMemo((): readonly ClusterCentroid[] => {
    const clusterMap = new Map<number, { xs: number[]; ys: number[]; label: string }>();

    for (const pt of points) {
      const existing = clusterMap.get(pt.clusterId);
      if (existing) {
        existing.xs.push(pt.position[0]);
        existing.ys.push(pt.position[1]);
      } else {
        clusterMap.set(pt.clusterId, {
          xs: [pt.position[0]],
          ys: [pt.position[1]],
          label: pt.clusterLabel,
        });
      }
    }

    return Array.from(clusterMap.values()).map((cluster) => ({
      label: cluster.label,
      position: [
        cluster.xs.reduce((a, b) => a + b, 0) / cluster.xs.length,
        cluster.ys.reduce((a, b) => a + b, 0) / cluster.ys.length,
      ] as const,
    }));
  }, [points]);

  const layers = useMemo(() => [
    new ScatterplotLayer<DeckGlPoint>({
      id: 'paper-scatter',
      data: points as DeckGlPoint[],
      getPosition: (d) => [d.position[0], d.position[1]],
      getRadius: (d) => Math.sqrt(Math.max(d.citationCount, 1)) * 2,
      getFillColor: (d) => {
        const color = CLUSTER_COLORS[d.clusterId % CLUSTER_COLORS.length];
        return [color[0], color[1], color[2], 200];
      },
      pickable: true,
      onClick: handleClick,
      radiusMinPixels: 4,
      radiusMaxPixels: 30,
    }),
    new TextLayer<ClusterCentroid>({
      id: 'cluster-labels',
      data: centroids as ClusterCentroid[],
      getPosition: (d) => [d.position[0], d.position[1]],
      getText: (d) => d.label,
      getSize: 16,
      getColor: [60, 60, 60, 220],
      fontFamily: 'system-ui, sans-serif',
      fontWeight: 600,
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
    }),
  ], [points, centroids, handleClick]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <DeckGL
        views={new OrthographicView({ id: 'ortho' })}
        initialViewState={{
          target: [0, 0],
          zoom: 3,
        }}
        controller={true}
        layers={layers}
      />
    </div>
  );
}
