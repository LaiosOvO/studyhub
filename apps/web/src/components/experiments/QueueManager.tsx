'use client';

import { useTranslations } from 'next-intl';

import type { ExperimentRun } from '@/lib/api/experiments';

interface QueueManagerProps {
  readonly runs: readonly ExperimentRun[];
  readonly onReorder: (
    runId: string,
    afterRunId?: string,
    beforeRunId?: string,
  ) => void;
  readonly onCancel: (runId: string) => void;
}

export default function QueueManager({
  runs,
  onReorder,
  onCancel,
}: QueueManagerProps) {
  const t = useTranslations('experiments');

  // Sort by queue_position immutably
  const sortedRuns = [...runs].sort(
    (a, b) => a.queue_position - b.queue_position,
  );

  if (sortedRuns.length === 0) {
    return (
      <p className="py-4 text-center text-gray-400">{t('noQueue')}</p>
    );
  }

  return (
    <div className="rounded-lg border divide-y">
      {sortedRuns.map((run, index) => {
        const isFirst = index === 0;
        const isLast = index === sortedRuns.length - 1;
        const prevRun = isFirst ? undefined : sortedRuns[index - 1];
        const nextRun = isLast ? undefined : sortedRuns[index + 1];

        return (
          <div
            key={run.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {run.plan_id.slice(0, 8)}
              </p>
              <p className="text-xs text-gray-500">
                {t('currentRound')}: 0 / {run.max_rounds}
                {run.created_at && (
                  <span className="ml-2">
                    {new Date(run.created_at).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {/* Move Up */}
              <button
                type="button"
                disabled={isFirst}
                onClick={() => {
                  if (prevRun) {
                    // Place before the previous run
                    onReorder(run.id, undefined, prevRun.id);
                  }
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
                title={t('moveUp')}
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
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </button>

              {/* Move Down */}
              <button
                type="button"
                disabled={isLast}
                onClick={() => {
                  if (nextRun) {
                    // Place after the next run
                    onReorder(run.id, nextRun.id);
                  }
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
                title={t('moveDown')}
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
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Cancel */}
              <button
                type="button"
                onClick={() => onCancel(run.id)}
                className="ml-1 rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                title={t('cancel')}
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
          </div>
        );
      })}
    </div>
  );
}
