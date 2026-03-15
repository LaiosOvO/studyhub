/**
 * API client for experiment plans.
 *
 * Provides typed functions for all plan CRUD operations,
 * plan generation, and approval workflows.
 */

import { apiFetch } from '../api';

// ─── TypeScript Interfaces ──────────────────────────────────────────────

export interface Baseline {
  readonly name: string;
  readonly paper_id?: string;
  readonly metrics?: Record<string, unknown>;
}

export interface Dataset {
  readonly name: string;
  readonly url?: string;
  readonly size?: string;
  readonly license?: string;
}

export interface RoadmapStep {
  readonly step: number;
  readonly description: string;
}

export interface FeasibilityScore {
  readonly compute_requirements: number;
  readonly data_availability: number;
  readonly expected_improvement: number;
  readonly difficulty: number;
  readonly overall: number;
  readonly explanation: string;
}

export interface ExperimentPlan {
  readonly id: string;
  readonly user_id: string;
  readonly task_id: string;
  readonly entry_type: 'direction' | 'paper' | 'gap';
  readonly source_paper_id: string | null;
  readonly source_gap_index: number | null;
  readonly title: string;
  readonly hypothesis: string;
  readonly method_description: string;
  readonly baselines: readonly Baseline[];
  readonly metrics: readonly string[];
  readonly datasets: readonly Dataset[];
  readonly technical_roadmap: readonly RoadmapStep[];
  readonly code_skeleton: string | null;
  readonly feasibility: FeasibilityScore | null;
  readonly data_strategy: 'open_source' | 'own_data' | 'hybrid';
  readonly status: 'draft' | 'approved' | 'executing' | 'completed';
  readonly created_at: string;
  readonly updated_at: string | null;
}

export interface PlanGenerationInput {
  readonly task_id: string;
  readonly entry_type: 'direction' | 'paper' | 'gap';
  readonly source_paper_id?: string;
  readonly source_gap_index?: number;
  readonly data_strategy?: 'open_source' | 'own_data' | 'hybrid';
  readonly num_plans?: number;
}

export interface PlanGenerationResult {
  readonly workflow_id: string;
  readonly task_id: string;
}

export interface PlanUpdate {
  readonly title?: string;
  readonly hypothesis?: string;
  readonly method_description?: string;
  readonly baselines?: readonly Baseline[];
  readonly metrics?: readonly string[];
  readonly datasets?: readonly Dataset[];
  readonly technical_roadmap?: readonly RoadmapStep[];
  readonly code_skeleton?: string;
  readonly data_strategy?: 'open_source' | 'own_data' | 'hybrid';
}

// ─── API Functions ──────────────────────────────────────────────────────

export async function fetchPlans(
  taskId?: string,
  status?: string,
  skip: number = 0,
  limit: number = 20,
): Promise<readonly ExperimentPlan[]> {
  const params = new URLSearchParams();
  if (taskId) params.set('task_id', taskId);
  if (status) params.set('status', status);
  params.set('skip', String(skip));
  params.set('limit', String(limit));

  const query = params.toString();
  const result = await apiFetch<readonly ExperimentPlan[]>(
    `/api/v1/plans/?${query}`,
  );

  if (result.success) {
    return result.data;
  }
  throw new Error(result.error);
}

export async function fetchPlan(planId: string): Promise<ExperimentPlan> {
  const result = await apiFetch<ExperimentPlan>(
    `/api/v1/plans/${planId}`,
  );

  if (result.success) {
    return result.data;
  }
  throw new Error(result.error);
}

export async function generatePlans(
  input: PlanGenerationInput,
): Promise<PlanGenerationResult> {
  const result = await apiFetch<PlanGenerationResult>(
    '/api/v1/plans/generate',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );

  if (result.success) {
    return result.data;
  }
  throw new Error(result.error);
}

export async function updatePlan(
  planId: string,
  updates: PlanUpdate,
): Promise<ExperimentPlan> {
  const result = await apiFetch<ExperimentPlan>(
    `/api/v1/plans/${planId}`,
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

export async function deletePlan(planId: string): Promise<void> {
  const result = await apiFetch<null>(`/api/v1/plans/${planId}`, {
    method: 'DELETE',
  });

  if (!result.success) {
    throw new Error(result.error);
  }
}

export async function approvePlan(
  planId: string,
): Promise<ExperimentPlan> {
  const result = await apiFetch<ExperimentPlan>(
    `/api/v1/plans/${planId}/approve`,
    {
      method: 'POST',
    },
  );

  if (result.success) {
    return result.data;
  }
  throw new Error(result.error);
}
