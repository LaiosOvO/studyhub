'use client';

import { useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';

import type { ExperimentRoundResult } from '@/lib/api/experiments';

interface IterationTableProps {
  readonly rounds: readonly ExperimentRoundResult[];
}

type SortColumn = 'round' | 'status' | 'metric_value' | 'duration_seconds';
type SortDirection = 'asc' | 'desc';

const STATUS_BADGE_COLORS: Record<string, string> = {
  keep: 'bg-green-100 text-green-700',
  baseline: 'bg-green-100 text-green-700',
  discard: 'bg-yellow-100 text-yellow-700',
  crash: 'bg-red-100 text-red-700',
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function compareValues(
  a: number | string | null,
  b: number | string | null,
  direction: SortDirection,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const cmp = a < b ? -1 : a > b ? 1 : 0;
  return direction === 'asc' ? cmp : -cmp;
}

export default function IterationTable({ rounds }: IterationTableProps) {
  const t = useTranslations('experiments');

  const [sortColumn, setSortColumn] = useState<SortColumn>('round');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedRounds = useMemo(() => {
    const copy = [...rounds];
    copy.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      return compareValues(aVal, bVal, sortDirection);
    });
    return copy;
  }, [rounds, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' \u2191' : ' \u2193';
  };

  if (rounds.length === 0) {
    return (
      <p className="py-8 text-center text-gray-400">{t('noIterations')}</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th
              className="cursor-pointer px-4 py-3 hover:text-gray-700"
              onClick={() => handleSort('round')}
            >
              {t('round')}
              {sortIndicator('round')}
            </th>
            <th
              className="cursor-pointer px-4 py-3 hover:text-gray-700"
              onClick={() => handleSort('status')}
            >
              {t('statusLabel')}
              {sortIndicator('status')}
            </th>
            <th
              className="cursor-pointer px-4 py-3 hover:text-gray-700"
              onClick={() => handleSort('metric_value')}
            >
              {t('metricValue')}
              {sortIndicator('metric_value')}
            </th>
            <th className="px-4 py-3">{t('description')}</th>
            <th
              className="cursor-pointer px-4 py-3 hover:text-gray-700"
              onClick={() => handleSort('duration_seconds')}
            >
              {t('duration')}
              {sortIndicator('duration_seconds')}
            </th>
            <th className="px-4 py-3">{t('gitSha')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sortedRounds.map((round) => {
            const badgeColor =
              STATUS_BADGE_COLORS[round.status] ?? 'bg-gray-100 text-gray-700';
            return (
              <tr key={round.round} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{round.round}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}
                  >
                    {round.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono">
                  {round.metric_value !== null
                    ? round.metric_value.toFixed(4)
                    : '-'}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-gray-600">
                  {round.description || '-'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDuration(round.duration_seconds)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {round.git_sha ? round.git_sha.slice(0, 7) : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
