'use client';

import { useTranslations } from 'next-intl';

import type { ExperimentRun } from '@/lib/api/experiments';

import IterationTable from './IterationTable';
import ProgressSummary from './ProgressSummary';
import TrainingCurveChart from './TrainingCurveChart';

interface ExperimentDashboardProps {
  readonly run: ExperimentRun;
}

export default function ExperimentDashboard({
  run,
}: ExperimentDashboardProps) {
  const t = useTranslations('experiments');

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-semibold">
          {t('experimentDashboard')}
        </h2>
        <p className="text-sm text-gray-500">
          {t('runId')}: {run.id.slice(0, 8)}...
        </p>
      </div>

      {/* Progress Summary Cards */}
      <ProgressSummary run={run} />

      {/* Training Curve Chart */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium">{t('trainingCurve')}</h3>
        <TrainingCurveChart
          rounds={run.rounds}
          metricName={run.best_metric_name ?? 'metric'}
        />
      </div>

      {/* Iteration Comparison Table */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium">
          {t('iterationComparison')}
        </h3>
        <IterationTable rounds={run.rounds} />
      </div>
    </div>
  );
}
