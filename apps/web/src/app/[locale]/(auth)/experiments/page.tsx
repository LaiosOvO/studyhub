'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import QueueManager from '@/components/experiments/QueueManager';
import { useExperimentStore } from '@/stores/experiment-store';

import type { ExperimentRun } from '@/lib/api/experiments';
import {
  cancelExperimentRun,
  fetchExperimentRuns,
  reorderExperimentRun,
} from '@/lib/api/experiments';

const STATUS_FILTERS = [
  'all',
  'pending',
  'running',
  'paused',
  'completed',
  'failed',
] as const;

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

export default function ExperimentsPage() {
  const t = useTranslations('experiments');
  const router = useRouter();

  const { statusFilter, setStatusFilter } = useExperimentStore();

  const [runs, setRuns] = useState<readonly ExperimentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filterStatus = statusFilter === 'all' ? undefined : statusFilter;
      const data = await fetchExperimentRuns(undefined, filterStatus);
      setRuns(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load experiments',
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  // Separate queued (pending) and other runs
  const { queuedRuns, otherRuns } = useMemo(() => {
    const queued = runs.filter((r) => r.status === 'pending');
    const others = runs.filter((r) => r.status !== 'pending');
    return { queuedRuns: queued, otherRuns: others };
  }, [runs]);

  const handleRunClick = useCallback(
    (runId: string) => {
      router.push(`experiments/${runId}`);
    },
    [router],
  );

  const handleReorder = useCallback(
    async (runId: string, afterRunId?: string, beforeRunId?: string) => {
      try {
        await reorderExperimentRun(runId, afterRunId, beforeRunId);
        await loadRuns();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to reorder experiment',
        );
      }
    },
    [loadRuns],
  );

  const handleCancel = useCallback(
    async (runId: string) => {
      try {
        await cancelExperimentRun(runId);
        await loadRuns();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to cancel experiment',
        );
      }
    },
    [loadRuns],
  );

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      {/* Status Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === filter
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filter === 'all' ? t('filterAll') : t(`status.${filter}`)}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <p className="text-center text-gray-500">{t('loading')}</p>
      )}

      {error && <p className="text-center text-red-600">{error}</p>}

      {!loading && !error && runs.length === 0 && (
        <p className="text-center text-gray-400">{t('emptyState')}</p>
      )}

      {!loading && !error && runs.length > 0 && (
        <>
          {/* Queue Section */}
          {queuedRuns.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-lg font-semibold">{t('queue')}</h2>
              <QueueManager
                runs={queuedRuns}
                onReorder={handleReorder}
                onCancel={handleCancel}
              />
            </div>
          )}

          {/* Run Cards Grid */}
          {otherRuns.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherRuns.map((run) => {
                const statusColor =
                  STATUS_COLORS[run.status] ?? 'bg-gray-100 text-gray-700';
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => handleRunClick(run.id)}
                    className="rounded-lg border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-sm text-gray-500">
                        {run.id.slice(0, 8)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
                      >
                        {t(`status.${run.status}`)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600">
                      {t('currentRound')}: {run.current_round} /{' '}
                      {run.max_rounds}
                    </p>

                    {run.best_metric_value !== null && (
                      <p className="text-sm text-gray-600">
                        {t('bestMetric')}:{' '}
                        {run.best_metric_value.toFixed(4)}
                      </p>
                    )}

                    {run.created_at && (
                      <p className="mt-2 text-xs text-gray-400">
                        {new Date(run.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
