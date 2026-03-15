'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePaperMapStore } from '@/stores/paper-map-store';
import { apiFetch } from '@/lib/api';

interface QualityBreakdown {
  readonly score: number;
  readonly citations_norm: number;
  readonly velocity_norm: number;
  readonly impact_factor_norm: number;
  readonly h_index_norm: number;
  readonly components_available: number;
}

interface PaperDetailPanelProps {
  readonly nodes: readonly {
    readonly id: string;
    readonly data: {
      readonly title: string;
      readonly citationCount: number;
      readonly qualityScore: number;
      readonly year: number;
      readonly methods: readonly string[];
      readonly abstract: string;
    };
  }[];
}

function QualityBar({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="mb-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div
          className="h-1.5 rounded-full bg-blue-500"
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

export function PaperDetailPanel({ nodes }: PaperDetailPanelProps) {
  const t = useTranslations('paperMap');
  const selectedPaperId = usePaperMapStore((state) => state.selectedPaperId);
  const selectPaper = usePaperMapStore((state) => state.selectPaper);
  const [quality, setQuality] = useState<QualityBreakdown | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);

  useEffect(() => {
    if (!selectedPaperId) {
      setQuality(null);
      return;
    }

    let cancelled = false;
    setQualityLoading(true);

    apiFetch<QualityBreakdown>(
      `/citations/paper/${selectedPaperId}/quality`,
    ).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setQuality(result.data);
      }
      setQualityLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedPaperId]);

  if (!selectedPaperId) return null;

  const selectedNode = nodes.find((n) => n.id === selectedPaperId);
  if (!selectedNode) return null;

  const { title, citationCount, qualityScore, year, methods, abstract } =
    selectedNode.data;

  return (
    <div className="absolute right-0 top-0 z-50 h-full w-80 overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-lg">
      <div className="mb-4 flex items-start justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {t('paperDetail.title')}
        </h3>
        <button
          onClick={() => selectPaper(null)}
          className="ml-2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label={t('paperDetail.close')}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <h4 className="mb-3 text-base font-medium text-gray-800">{title}</h4>

      <div className="mb-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('paperDetail.year')}</span>
          <span className="font-medium">{year}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('paperDetail.citations')}</span>
          <span className="font-medium">{citationCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">
            {t('paperDetail.qualityScore')}
          </span>
          <span className="font-medium">{(qualityScore * 100).toFixed(0)}%</span>
        </div>
      </div>

      {methods.length > 0 && (
        <div className="mb-4">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            {t('paperDetail.methods')}
          </span>
          <div className="flex flex-wrap gap-1">
            {methods.map((method) => (
              <span
                key={method}
                className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      )}

      {abstract && (
        <div className="mb-4">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            Abstract
          </span>
          <p className="line-clamp-6 text-xs leading-relaxed text-gray-600">
            {abstract}
          </p>
        </div>
      )}

      {qualityLoading && (
        <p className="text-xs text-gray-400">{t('loading')}</p>
      )}

      {quality && (
        <div className="rounded-lg bg-gray-50 p-3">
          <span className="mb-2 block text-xs font-medium text-gray-500">
            {t('paperDetail.qualityScore')} {t('paperDetail.breakdown')}
          </span>
          <QualityBar label="Citations" value={quality.citations_norm} />
          <QualityBar label="Velocity" value={quality.velocity_norm} />
          <QualityBar label="Impact Factor" value={quality.impact_factor_norm} />
          <QualityBar label="H-Index" value={quality.h_index_norm} />
        </div>
      )}
    </div>
  );
}
