/**
 * Typed wrappers around Tauri invoke for experiment commands.
 *
 * Provides type-safe access to all Tauri Rust commands with
 * matching TypeScript types for the experiment state machine.
 */

import { invoke } from "@tauri-apps/api/core";

// ─── Type Definitions ────────────────────────────────────────────────────────

/** Matches Rust ExperimentStatus enum (tagged union). */
export type ExperimentStatus =
  | { type: "Idle" }
  | { type: "SettingUp"; data: { plan_id: string } }
  | { type: "RunningBaseline"; data: { plan_id: string } }
  | {
      type: "Running";
      data: { plan_id: string; round: number; best_metric: number };
    }
  | { type: "Paused"; data: { plan_id: string; round: number } }
  | { type: "Completed"; data: { plan_id: string; rounds: number } }
  | { type: "Failed"; data: { plan_id: string; error: string } };

/** GPU metrics from pynvml monitoring. */
export interface GpuMetrics {
  name: string;
  gpu_utilization_pct: number;
  memory_used_mb: number;
  memory_total_mb: number;
  temperature_c: number;
  power_watts: number;
}

/** GPU device information. */
export interface GpuInfo {
  index: number;
  name: string;
  memory_total_mb: number;
  driver_version: string;
}

/** Sync payload sent from desktop to web backend. */
export interface ExperimentSyncPayload {
  run_id: string;
  status: string;
  current_round: number;
  best_metric_value: number | null;
  gpu_metrics: GpuMetrics | null;
  latest_round: ExperimentRoundResult | null;
}

/** A single experiment iteration result. */
export interface ExperimentRoundResult {
  round: number;
  status: string;
  metric_value: number | null;
  description: string;
  git_sha: string | null;
  duration_seconds: number | null;
}

// ─── Command Wrappers ────────────────────────────────────────────────────────

/** Get the current experiment status from the Rust state machine. */
export function getExperimentStatus(): Promise<ExperimentStatus> {
  return invoke<ExperimentStatus>("get_status");
}

/** Start a new experiment with the given plan and config. */
export function startExperiment(
  planId: string,
  config: Record<string, unknown>,
): Promise<string> {
  return invoke<string>("start_experiment", {
    planId,
    config,
  });
}

/** Pause the currently running experiment. */
export function pauseExperiment(): Promise<void> {
  return invoke<void>("pause_experiment");
}

/** Resume a paused experiment. */
export function resumeExperiment(): Promise<void> {
  return invoke<void>("resume_experiment");
}

/** Cancel the current experiment and return to Idle. */
export function cancelExperiment(): Promise<void> {
  return invoke<void>("cancel_experiment");
}

/** Skip the current iteration. */
export function skipIteration(): Promise<void> {
  return invoke<void>("skip_iteration");
}

/** Send manual guidance for the next iteration. */
export function sendGuidance(guidance: string): Promise<void> {
  return invoke<void>("send_guidance", { guidance });
}

// ─── GPU Monitoring Commands ─────────────────────────────────────────────────

/** Get available GPU information. */
export function getGpuInfo(): Promise<GpuInfo[]> {
  return invoke<GpuInfo[]>("get_gpu_info");
}

/** Start GPU monitoring, emitting "gpu-metrics" events. */
export function startGpuMonitoring(deviceId: number): Promise<void> {
  return invoke<void>("start_gpu_monitoring", { deviceId });
}

/** Stop GPU monitoring. */
export function stopGpuMonitoring(): Promise<void> {
  return invoke<void>("stop_gpu_monitoring");
}

// ─── Backend Sync Commands ───────────────────────────────────────────────────

/** Connect to web backend via WebSocket. */
export function connectBackend(url: string, token: string): Promise<void> {
  return invoke<void>("connect_backend", { url, token });
}

/** Disconnect from web backend. */
export function disconnectBackend(): Promise<void> {
  return invoke<void>("disconnect_backend");
}

/** Send experiment sync payload to web backend. */
export function sendSync(payload: ExperimentSyncPayload): Promise<void> {
  return invoke<void>("send_sync", { payload });
}
