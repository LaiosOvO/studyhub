/**
 * API client for experiment runs.
 *
 * Provides typed functions for experiment CRUD operations,
 * real-time WebSocket connection, and report access.
 */

import { apiFetch } from '../api';

// ─── TypeScript Interfaces ──────────────────────────────────────────────

export interface ExperimentRoundResult {
  readonly round: number;
  readonly status: string;
  readonly metric_value: number | null;
  readonly description: string;
  readonly git_sha: string | null;
  readonly duration_seconds: number | null;
}

export interface GpuMetrics {
  readonly gpu_utilization_pct: number;
  readonly memory_used_mb: number;
  readonly memory_total_mb: number;
  readonly temperature_c: number;
  readonly power_watts: number;
  readonly name: string;
}

export interface ExperimentRun {
  readonly id: string;
  readonly user_id: string;
  readonly plan_id: string;
  readonly status: string;
  readonly workspace_path: string | null;
  readonly docker_image: string | null;
  readonly gpu_device: number;
  readonly current_round: number;
  readonly max_rounds: number;
  readonly consecutive_no_improve_limit: number;
  readonly time_budget_minutes: number | null;
  readonly best_metric_name: string | null;
  readonly best_metric_value: number | null;
  readonly baseline_metric_value: number | null;
  readonly queue_position: number;
  readonly rounds: readonly ExperimentRoundResult[];
  readonly config: Record<string, unknown>;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
}

export interface ExperimentProgress {
  readonly run_id: string;
  readonly status: string;
  readonly current_round: number;
  readonly max_rounds: number;
  readonly best_metric_name: string | null;
  readonly best_metric_value: number | null;
  readonly baseline_metric_value: number | null;
  readonly rounds: readonly ExperimentRoundResult[];
  readonly gpu_metrics: GpuMetrics | null;
}

// ─── API Functions ──────────────────────────────────────────────────────

export async function fetchExperimentRuns(
  planId?: string,
  status?: string,
  skip: number = 0,
  limit: number = 20,
): Promise<readonly ExperimentRun[]> {
  const params = new URLSearchParams();
  if (planId) params.set('plan_id', planId);
  if (status) params.set('status', status);
  params.set('skip', String(skip));
  params.set('limit', String(limit));

  const query = params.toString();
  const result = await apiFetch<readonly ExperimentRun[]>(
    `/api/v1/experiments/?${query}`,
  );

  if (result.success) {
    return result.data;
  }
  throw new Error(result.error);
}

export async function fetchExperimentRun(
  runId: string,
): Promise<ExperimentRun> {
  const result = await apiFetch<ExperimentRun>(
    `/api/v1/experiments/${runId}`,
  );

  if (result.success) {
    return result.data;
  }
  throw new Error(result.error);
}

export async function updateExperimentRun(
  runId: string,
  updates: Record<string, unknown>,
): Promise<ExperimentRun> {
  const result = await apiFetch<ExperimentRun>(
    `/api/v1/experiments/${runId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    },
  );

  if (result.success) {
    return result.data;
  }
  throw new Error(result.error);
}

export async function deleteExperimentRun(
  runId: string,
): Promise<void> {
  const result = await apiFetch<null>(
    `/api/v1/experiments/${runId}`,
    { method: 'DELETE' },
  );

  if (!result.success) {
    throw new Error(result.error);
  }
}

export async function reorderExperimentRun(
  runId: string,
  afterRunId?: string,
  beforeRunId?: string,
): Promise<ExperimentRun> {
  const body: Record<string, string | undefined> = {};
  if (afterRunId !== undefined) body.after_run_id = afterRunId;
  if (beforeRunId !== undefined) body.before_run_id = beforeRunId;

  const result = await apiFetch<ExperimentRun>(
    `/api/v1/experiments/${runId}/reorder`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );

  if (result.success) {
    return result.data;
  }
  throw new Error(result.error);
}

export async function cancelExperimentRun(
  runId: string,
): Promise<ExperimentRun> {
  const result = await apiFetch<ExperimentRun>(
    `/api/v1/experiments/${runId}/cancel`,
    { method: 'POST' },
  );

  if (result.success) {
    return result.data;
  }
  throw new Error(result.error);
}

// ─── Report API ─────────────────────────────────────────────────────────

export interface ExperimentReportResponse {
  readonly run_id: string;
  readonly has_report: boolean;
  readonly markdown: string | null;
  readonly pdf_url: string | null;
}

export async function fetchExperimentReport(
  runId: string,
  format: 'markdown' | 'pdf' = 'markdown',
): Promise<ExperimentReportResponse> {
  const result = await apiFetch<ExperimentReportResponse>(
    `/api/v1/experiments/${runId}/report?format=${format}`,
  );

  if (result.success) {
    return result.data;
  }
  throw new Error(result.error);
}

export async function generateExperimentReport(
  runId: string,
): Promise<ExperimentReportResponse> {
  const result = await apiFetch<ExperimentReportResponse>(
    `/api/v1/experiments/${runId}/report/generate`,
    { method: 'POST' },
  );

  if (result.success) {
    return result.data;
  }
  throw new Error(result.error);
}

export async function downloadExperimentReportPdf(
  runId: string,
): Promise<Blob> {
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const { getAccessToken } = await import('../auth');
  const token = getAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/api/v1/experiments/${runId}/report/pdf`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    throw new Error('Failed to download PDF report');
  }

  return response.blob();
}
