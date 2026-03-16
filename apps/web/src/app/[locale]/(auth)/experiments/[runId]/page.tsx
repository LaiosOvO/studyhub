'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import ExperimentDashboard from '@/components/experiments/ExperimentDashboard';

import type { ExperimentProgress, ExperimentRun } from '@/lib/api/experiments';
import { fetchExperimentRun } from '@/lib/api/experiments';
import { getAccessToken } from '@/lib/auth';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled']);

export default function ExperimentRunPage() {
  const t = useTranslations('experiments');
  const params = useParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<ExperimentRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch initial run data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchExperimentRun(runId);
        if (!cancelled) {
          setRun(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load experiment',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  // WebSocket for real-time updates
  const handleWsMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const progress: ExperimentProgress = JSON.parse(event.data);
        if (progress.run_id !== runId) return;

        // Create new run object immutably from progress data
        setRun((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: progress.status,
            current_round: progress.current_round,
            max_rounds: progress.max_rounds,
            best_metric_name: progress.best_metric_name,
            best_metric_value: progress.best_metric_value,
            baseline_metric_value: progress.baseline_metric_value,
            rounds: progress.rounds,
            config: progress.gpu_metrics
              ? { ...prev.config, gpu_metrics: progress.gpu_metrics }
              : prev.config,
          };
        });
      } catch {
        // Ignore malformed messages
      }
    },
    [runId],
  );

  useEffect(() => {
    if (!run || TERMINAL_STATES.has(run.status)) return;

    const token = getAccessToken();
    if (!token) return;

    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(
      `${wsUrl}/api/v1/experiments/ws/${runId}?token=${token}`,
    );

    ws.onmessage = handleWsMessage;
    ws.onerror = () => {
      // WebSocket errors are non-fatal; dashboard still works via initial fetch
    };

    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [run?.status, runId, handleWsMessage]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-center text-gray-500">{t('loading')}</p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-center text-red-600">{error ?? t('notFound')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link
        href="../experiments"
        className="mb-4 inline-block text-sm text-blue-600 hover:underline"
      >
        {t('backToExperiments')}
      </Link>

      <ExperimentDashboard run={run} />
    </div>
  );
}
