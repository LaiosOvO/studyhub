'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import {
  approvePlan,
  deletePlan,
  fetchPlan,
  updatePlan,
  type Baseline,
  type Dataset,
  type ExperimentPlan,
  type RoadmapStep,
} from '@/lib/api/plans';

// ─── Feasibility Display ───────────────────────────────────────────────

function FeasibilityBar({
  label,
  value,
  max,
}: {
  readonly label: string;
  readonly value: number;
  readonly max: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const color =
    value >= 4
      ? 'bg-green-500'
      : value >= 3
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-sm text-gray-600">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-gray-200">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-sm font-medium text-gray-700">
        {value}
      </span>
    </div>
  );
}

function FeasibilitySection({
  feasibility,
}: {
  readonly feasibility: ExperimentPlan['feasibility'];
}) {
  const t = useTranslations('plans');

  if (!feasibility) {
    return (
      <p className="text-sm text-gray-400">{t('feasibilityUnavailable')}</p>
    );
  }

  const overallColor =
    feasibility.overall >= 3.5
      ? 'text-green-700'
      : feasibility.overall >= 2.5
        ? 'text-yellow-700'
        : 'text-red-700';

  return (
    <div className="flex flex-col gap-3">
      <FeasibilityBar
        label={t('feasibilityCompute')}
        value={feasibility.compute_requirements}
        max={5}
      />
      <FeasibilityBar
        label={t('feasibilityData')}
        value={feasibility.data_availability}
        max={5}
      />
      <FeasibilityBar
        label={t('feasibilityImprovement')}
        value={feasibility.expected_improvement}
        max={5}
      />
      <FeasibilityBar
        label={t('feasibilityDifficulty')}
        value={feasibility.difficulty}
        max={5}
      />
      <div className="flex items-center gap-2 pt-2">
        <span className="text-sm font-medium text-gray-700">
          {t('feasibilityOverall')}:
        </span>
        <span className={`text-lg font-bold ${overallColor}`}>
          {feasibility.overall.toFixed(1)}
        </span>
      </div>
      <p className="text-sm text-gray-500">{feasibility.explanation}</p>
    </div>
  );
}

// ─── List Editor (Baselines / Datasets / Metrics / Roadmap) ────────────

function TagListEditor({
  items,
  onChange,
  placeholder,
  disabled,
}: {
  readonly items: readonly string[];
  readonly onChange: (items: readonly string[]) => void;
  readonly placeholder: string;
  readonly disabled: boolean;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setInputValue('');
    }
  }, [inputValue, items, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange([...items.slice(0, index), ...items.slice(index + 1)]);
    },
    [items, onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-sm text-gray-700"
          >
            {item}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="ml-0.5 text-gray-400 hover:text-red-500"
              >
                x
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            placeholder={placeholder}
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

function BaselineListEditor({
  baselines,
  onChange,
  disabled,
}: {
  readonly baselines: readonly Baseline[];
  readonly onChange: (baselines: readonly Baseline[]) => void;
  readonly disabled: boolean;
}) {
  const t = useTranslations('plans');

  const handleAdd = useCallback(() => {
    onChange([...baselines, { name: '' }]);
  }, [baselines, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange([...baselines.slice(0, index), ...baselines.slice(index + 1)]);
    },
    [baselines, onChange],
  );

  const handleNameChange = useCallback(
    (index: number, name: string) => {
      onChange(
        baselines.map((bl, i) => (i === index ? { ...bl, name } : bl)),
      );
    },
    [baselines, onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      {baselines.map((bl, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            value={bl.name}
            onChange={(e) => handleNameChange(idx, e.target.value)}
            disabled={disabled}
            placeholder={t('baselineName')}
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              x
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={handleAdd}
          className="self-start rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
        >
          + {t('addBaseline')}
        </button>
      )}
    </div>
  );
}

function DatasetListEditor({
  datasets,
  onChange,
  disabled,
}: {
  readonly datasets: readonly Dataset[];
  readonly onChange: (datasets: readonly Dataset[]) => void;
  readonly disabled: boolean;
}) {
  const t = useTranslations('plans');

  const handleAdd = useCallback(() => {
    onChange([...datasets, { name: '' }]);
  }, [datasets, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange([...datasets.slice(0, index), ...datasets.slice(index + 1)]);
    },
    [datasets, onChange],
  );

  const handleFieldChange = useCallback(
    (index: number, field: keyof Dataset, value: string) => {
      onChange(
        datasets.map((ds, i) =>
          i === index ? { ...ds, [field]: value } : ds,
        ),
      );
    },
    [datasets, onChange],
  );

  return (
    <div className="flex flex-col gap-3">
      {datasets.map((ds, idx) => (
        <div key={idx} className="flex flex-col gap-1.5 rounded-md border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <input
              type="text"
              value={ds.name}
              onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
              disabled={disabled}
              placeholder={t('datasetName')}
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="ml-2 text-sm text-red-500 hover:text-red-700"
              >
                x
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={ds.url ?? ''}
              onChange={(e) => handleFieldChange(idx, 'url', e.target.value)}
              disabled={disabled}
              placeholder="URL"
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
            />
            <input
              type="text"
              value={ds.license ?? ''}
              onChange={(e) => handleFieldChange(idx, 'license', e.target.value)}
              disabled={disabled}
              placeholder={t('datasetLicense')}
              className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
            />
          </div>
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={handleAdd}
          className="self-start rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
        >
          + {t('addDataset')}
        </button>
      )}
    </div>
  );
}

function RoadmapEditor({
  steps,
  onChange,
  disabled,
}: {
  readonly steps: readonly RoadmapStep[];
  readonly onChange: (steps: readonly RoadmapStep[]) => void;
  readonly disabled: boolean;
}) {
  const t = useTranslations('plans');

  const handleAdd = useCallback(() => {
    const nextStep = steps.length > 0 ? steps[steps.length - 1].step + 1 : 1;
    onChange([...steps, { step: nextStep, description: '' }]);
  }, [steps, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      const updated = [
        ...steps.slice(0, index),
        ...steps.slice(index + 1),
      ];
      // Re-number steps
      onChange(updated.map((s, i) => ({ ...s, step: i + 1 })));
    },
    [steps, onChange],
  );

  const handleDescChange = useCallback(
    (index: number, description: string) => {
      onChange(
        steps.map((s, i) => (i === index ? { ...s, description } : s)),
      );
    },
    [steps, onChange],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const updated = [...steps];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      onChange(updated.map((s, i) => ({ ...s, step: i + 1 })));
    },
    [steps, onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, idx) => (
        <div key={idx} className="flex items-start gap-2">
          <span className="mt-2 w-6 shrink-0 text-center text-sm font-medium text-gray-400">
            {step.step}
          </span>
          <textarea
            value={step.description}
            onChange={(e) => handleDescChange(idx, e.target.value)}
            disabled={disabled}
            rows={2}
            className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
          />
          {!disabled && (
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => handleMoveUp(idx)}
                disabled={idx === 0}
                className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
              >
                ^
              </button>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                x
              </button>
            </div>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={handleAdd}
          className="self-start rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
        >
          + {t('addStep')}
        </button>
      )}
    </div>
  );
}

// ─── Data Strategy Radio ───────────────────────────────────────────────

const DATA_STRATEGIES = ['open_source', 'own_data', 'hybrid'] as const;

function DataStrategyRadio({
  value,
  onChange,
  disabled,
}: {
  readonly value: string;
  readonly onChange: (strategy: 'open_source' | 'own_data' | 'hybrid') => void;
  readonly disabled: boolean;
}) {
  const t = useTranslations('plans');

  return (
    <div className="flex flex-wrap gap-3">
      {DATA_STRATEGIES.map((strategy) => (
        <label key={strategy} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="data_strategy"
            value={strategy}
            checked={value === strategy}
            onChange={() => onChange(strategy)}
            disabled={disabled}
            className="text-blue-600 focus:ring-blue-500"
          />
          {t(`dataStrategy.${strategy}`)}
        </label>
      ))}
    </div>
  );
}

// ─── Confirmation Dialog ───────────────────────────────────────────────

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  readonly title: string;
  readonly message: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section Wrapper ───────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────

export default function PlanDetailPage() {
  const t = useTranslations('plans');
  const router = useRouter();
  const params = useParams();
  const planId = params.planId as string;

  const [plan, setPlan] = useState<ExperimentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable form state
  const [title, setTitle] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [methodDescription, setMethodDescription] = useState('');
  const [baselines, setBaselines] = useState<readonly Baseline[]>([]);
  const [metrics, setMetrics] = useState<readonly string[]>([]);
  const [datasets, setDatasets] = useState<readonly Dataset[]>([]);
  const [roadmap, setRoadmap] = useState<readonly RoadmapStep[]>([]);
  const [dataStrategy, setDataStrategy] = useState<'open_source' | 'own_data' | 'hybrid'>('open_source');

  // Dialog state
  const [confirmAction, setConfirmAction] = useState<'approve' | 'delete' | null>(null);

  const isDraft = plan?.status === 'draft';

  // Load plan
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPlan(planId);
        setPlan(data);
        setTitle(data.title);
        setHypothesis(data.hypothesis);
        setMethodDescription(data.method_description);
        setBaselines(data.baselines);
        setMetrics([...data.metrics]);
        setDatasets(data.datasets);
        setRoadmap(data.technical_roadmap);
        setDataStrategy(data.data_strategy);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [planId]);

  // Save
  const handleSave = useCallback(async () => {
    if (!plan || !isDraft) return;
    setSaving(true);
    setError(null);
    try {
      const updates: Record<string, unknown> = {};
      if (title !== plan.title) updates.title = title;
      if (hypothesis !== plan.hypothesis) updates.hypothesis = hypothesis;
      if (methodDescription !== plan.method_description)
        updates.method_description = methodDescription;
      if (JSON.stringify(baselines) !== JSON.stringify(plan.baselines))
        updates.baselines = baselines;
      if (JSON.stringify(metrics) !== JSON.stringify(plan.metrics))
        updates.metrics = metrics;
      if (JSON.stringify(datasets) !== JSON.stringify(plan.datasets))
        updates.datasets = datasets;
      if (JSON.stringify(roadmap) !== JSON.stringify(plan.technical_roadmap))
        updates.technical_roadmap = roadmap;
      if (dataStrategy !== plan.data_strategy)
        updates.data_strategy = dataStrategy;

      if (Object.keys(updates).length > 0) {
        const updated = await updatePlan(planId, updates);
        setPlan(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [
    plan,
    isDraft,
    planId,
    title,
    hypothesis,
    methodDescription,
    baselines,
    metrics,
    datasets,
    roadmap,
    dataStrategy,
  ]);

  // Approve
  const handleApprove = useCallback(async () => {
    setConfirmAction(null);
    try {
      const updated = await approvePlan(planId);
      setPlan(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  }, [planId]);

  // Delete
  const handleDelete = useCallback(async () => {
    setConfirmAction(null);
    try {
      await deletePlan(planId);
      router.push('.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [planId, router]);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500">{t('loading')}</div>
    );
  }

  if (error && !plan) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push('.')}
        className="mb-4 text-sm text-blue-600 hover:underline"
      >
        &larr; {t('backToPlans')}
      </button>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!isDraft}
          className="border-b border-gray-200 pb-2 text-xl font-bold text-gray-900 focus:border-blue-500 focus:outline-none disabled:bg-transparent"
        />

        {/* Hypothesis */}
        <Section title={t('hypothesis')}>
          <textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            disabled={!isDraft}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
          />
        </Section>

        {/* Method Description */}
        <Section title={t('method')}>
          <textarea
            value={methodDescription}
            onChange={(e) => setMethodDescription(e.target.value)}
            disabled={!isDraft}
            rows={5}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
          />
        </Section>

        {/* Baselines */}
        <Section title={t('baselines')}>
          <BaselineListEditor
            baselines={baselines}
            onChange={setBaselines}
            disabled={!isDraft}
          />
        </Section>

        {/* Metrics */}
        <Section title={t('metrics')}>
          <TagListEditor
            items={metrics}
            onChange={setMetrics}
            placeholder={t('addMetric')}
            disabled={!isDraft}
          />
        </Section>

        {/* Datasets */}
        <Section title={t('datasets')}>
          <DatasetListEditor
            datasets={datasets}
            onChange={setDatasets}
            disabled={!isDraft}
          />
        </Section>

        {/* Technical Roadmap */}
        <Section title={t('roadmap')}>
          <RoadmapEditor
            steps={roadmap}
            onChange={setRoadmap}
            disabled={!isDraft}
          />
        </Section>

        {/* Feasibility Score */}
        <Section title={t('feasibility')}>
          <FeasibilitySection feasibility={plan.feasibility} />
        </Section>

        {/* Code Skeleton */}
        <Section title={t('codeSkeleton')}>
          {plan.code_skeleton ? (
            <div className="overflow-x-auto rounded-md bg-gray-900 p-4">
              <pre className="text-sm leading-relaxed text-gray-100">
                <code>{plan.code_skeleton}</code>
              </pre>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              {t('codeSkeletonUnavailable')}
            </p>
          )}
        </Section>

        {/* Data Strategy */}
        <Section title={t('dataStrategyLabel')}>
          <DataStrategyRadio
            value={dataStrategy}
            onChange={setDataStrategy}
            disabled={!isDraft}
          />
        </Section>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
          {isDraft && (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? t('saving') : t('save')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction('approve')}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                {t('approve')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction('delete')}
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                {t('delete')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Dialogs */}
      {confirmAction === 'approve' && (
        <ConfirmDialog
          title={t('approveConfirmTitle')}
          message={t('approveConfirmMessage')}
          onConfirm={handleApprove}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === 'delete' && (
        <ConfirmDialog
          title={t('deleteConfirmTitle')}
          message={t('deleteConfirmMessage')}
          onConfirm={handleDelete}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
