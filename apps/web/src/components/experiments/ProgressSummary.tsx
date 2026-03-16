'use client';

import { useTranslations } from 'next-intl';

import type { ExperimentRun } from '@/lib/api/experiments';

interface ProgressSummaryProps {
  readonly run: ExperimentRun;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  setting_up: 'bg-blue-100 text-blue-700',
  baseline: 'bg-blue-100 text-blue-700',
  running: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function computeImprovement(
  baseline: number | null,
  best: number | null,
): number | null {
  if (baseline === null || best === null || baseline === 0) {
    return null;
  }
  return ((baseline - best) / Math.abs(baseline)) * 100;
}

export default function ProgressSummary({ run }: ProgressSummaryProps) {
  const t = useTranslations('experiments');

  const improvement = computeImprovement(
    run.baseline_metric_value,
    run.best_metric_value,
  );

  const statusColor = STATUS_COLORS[run.status] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {/* Current Round */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">{t('currentRound')}</p>
        <p className="mt-1 text-2xl font-semibold">
          {run.current_round}{' '}
          <span className="text-base font-normal text-gray-400">
            / {run.max_rounds}
          </span>
        </p>
      </div>

      {/* Best Metric */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">{t('bestMetric')}</p>
        <p className="mt-1 text-2xl font-semibold">
          {run.best_metric_value !== null
            ? run.best_metric_value.toFixed(4)
            : 'N/A'}
        </p>
        {run.best_metric_name && (
          <p className="text-xs text-gray-400">{run.best_metric_name}</p>
        )}
      </div>

      {/* Improvement */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">{t('improvement')}</p>
        <p
          className={`mt-1 text-2xl font-semibold ${
            improvement !== null && improvement > 0
              ? 'text-green-600'
              : improvement !== null && improvement < 0
                ? 'text-red-600'
                : ''
          }`}
        >
          {improvement !== null ? `${improvement.toFixed(1)}%` : 'N/A'}
        </p>
      </div>

      {/* Status */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">{t('statusLabel')}</p>
        <span
          className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${statusColor}`}
        >
          {t(`status.${run.status}`)}
        </span>
      </div>
    </div>
  );
}
