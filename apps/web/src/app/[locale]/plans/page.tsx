'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { fetchPlans, type ExperimentPlan } from '@/lib/api/plans';

// ─── Status Badge ──────────────────────────────────────────────────────

function StatusBadge({ status }: { readonly status: string }) {
  const t = useTranslations('plans');
  const colorMap: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    approved: 'bg-blue-100 text-blue-700',
    executing: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
  };
  const color = colorMap[status] ?? 'bg-gray-100 text-gray-700';

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {t(`status.${status}`)}
    </span>
  );
}

// ─── Entry Type Badge ──────────────────────────────────────────────────

function EntryTypeBadge({ entryType }: { readonly entryType: string }) {
  const colorMap: Record<string, string> = {
    direction: 'bg-purple-100 text-purple-700',
    paper: 'bg-indigo-100 text-indigo-700',
    gap: 'bg-orange-100 text-orange-700',
  };
  const color = colorMap[entryType] ?? 'bg-gray-100 text-gray-700';

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {entryType}
    </span>
  );
}

// ─── Feasibility Score ─────────────────────────────────────────────────

function FeasibilityBadge({ score }: { readonly score: number }) {
  const color =
    score >= 3.5
      ? 'text-green-700 bg-green-100'
      : score >= 2.5
        ? 'text-yellow-700 bg-yellow-100'
        : 'text-red-700 bg-red-100';

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

// ─── Plan Card ─────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onClick,
}: {
  readonly plan: ExperimentPlan;
  readonly onClick: () => void;
}) {
  const t = useTranslations('plans');
  const createdDate = plan.created_at
    ? new Date(plan.created_at).toLocaleDateString()
    : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
          {plan.title}
        </h3>
        <StatusBadge status={plan.status} />
      </div>

      <p className="line-clamp-2 text-xs text-gray-500">
        {plan.hypothesis}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <EntryTypeBadge entryType={plan.entry_type} />
        {plan.feasibility && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">{t('feasibility')}:</span>
            <FeasibilityBadge score={plan.feasibility.overall} />
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400">{createdDate}</div>
    </button>
  );
}

// ─── Status Filter ─────────────────────────────────────────────────────

const STATUS_OPTIONS = ['all', 'draft', 'approved', 'executing', 'completed'] as const;

// ─── Main Page ─────────────────────────────────────────────────────────

export default function PlansPage() {
  const t = useTranslations('plans');
  const router = useRouter();

  const [plans, setPlans] = useState<readonly ExperimentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const result = await fetchPlans(undefined, status);
      setPlans(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleCardClick = useCallback(
    (planId: string) => {
      router.push(`plans/${planId}`);
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? t('filterAll') : t(`status.${status}`)}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="py-12 text-center text-gray-500">{t('loading')}</div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && plans.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-sm text-gray-500">{t('emptyState')}</p>
        </div>
      )}

      {!loading && !error && plans.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onClick={() => handleCardClick(plan.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
