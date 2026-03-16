'use client';

import { useTranslations } from 'next-intl';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ExperimentRoundResult } from '@/lib/api/experiments';

interface TrainingCurveChartProps {
  readonly rounds: readonly ExperimentRoundResult[];
  readonly metricName: string;
}

interface ChartDataPoint {
  readonly round: number;
  readonly value: number;
  readonly status: string;
}

const STATUS_DOT_COLORS: Record<string, string> = {
  keep: '#22c55e',
  baseline: '#22c55e',
  discard: '#f97316',
  crash: '#ef4444',
};

function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartDataPoint;
}) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;

  const fill = STATUS_DOT_COLORS[payload.status] ?? '#4A90D9';

  return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="none" />;
}

export default function TrainingCurveChart({
  rounds,
  metricName,
}: TrainingCurveChartProps) {
  const t = useTranslations('experiments');

  const chartData: readonly ChartDataPoint[] = rounds
    .filter((r) => r.metric_value !== null)
    .map((r) => ({
      round: r.round,
      value: r.metric_value as number,
      status: r.status,
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-gray-400">
        {t('noChartData')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData as ChartDataPoint[]}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="round" label={{ value: t('round'), position: 'bottom' }} />
        <YAxis label={{ value: metricName, angle: -90, position: 'insideLeft' }} />
        <Tooltip
          formatter={(value: number) => [value.toFixed(4), metricName]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="value"
          name={metricName}
          stroke="#4A90D9"
          strokeWidth={2}
          dot={<CustomDot />}
          activeDot={{ r: 7 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
