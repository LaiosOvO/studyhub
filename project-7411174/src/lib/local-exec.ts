/**
 * Local execution abstraction layer.
 *
 * Detects Tauri desktop environment and uses local commands for:
 * - Git workspace (init, commit, reset)
 * - Subprocess execution (python train.py)
 * - File system I/O
 *
 * Falls back to backend API when not in Tauri.
 */

import { autoresearchApi } from "./api";

// ── Tauri Detection ─────────────────────────────────────────────

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
}

/** Dynamically import Tauri invoke (only available in desktop).
 *  Uses globalThis.__TAURI_INTERNALS__ directly to avoid bundler errors. */
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Access Tauri internals directly — avoids needing @tauri-apps/api as a dependency
  const internals = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ as
    | { invoke: (cmd: string, args?: unknown) => Promise<T> }
    | undefined;
  if (!internals?.invoke) {
    throw new Error("Tauri runtime not available");
  }
  return internals.invoke(cmd, args);
}

// ── Types ───────────────────────────────────────────────────────

export interface InitResult {
  run_id: string;
  workspace_path: string;
}

export interface WriteResult {
  commit_sha: string;
  path: string;
}

export interface ExecResult {
  exit_code: number;
  duration_seconds: number;
  stdout: string;
  stderr: string;
  metrics: Record<string, number>;
  error: string | null;
}

export interface DecideResult {
  head_sha: string;
  action: string;
}

// ── Unified API ─────────────────────────────────────────────────

/** Initialize a workspace (local git in Tauri, backend API otherwise). */
export async function initRun(opts: {
  run_id?: string;
  base_code?: string;
  prepare_code?: string;
  requirements?: string;
}): Promise<InitResult> {
  const runId = opts.run_id || `ar_${Date.now()}`;

  if (isTauri()) {
    return tauriInvoke<InitResult>("local_ar_init", {
      runId,
      baseCode: opts.base_code ?? null,
      prepareCode: opts.prepare_code ?? null,
      requirements: opts.requirements ?? null,
    });
  }

  return autoresearchApi.initRun({ ...opts, run_id: runId });
}

/** Write code file and git commit. */
export async function writeCode(
  runId: string,
  path: string,
  content: string,
  message?: string,
): Promise<WriteResult> {
  if (isTauri()) {
    return tauriInvoke<WriteResult>("local_ar_write_code", {
      runId,
      path,
      content,
      message: message ?? null,
    });
  }

  return autoresearchApi.writeCode(runId, path, content, message);
}

/** Execute a command in the workspace (real subprocess). */
export async function executeCode(
  runId: string,
  opts?: {
    command?: string;
    timeout_seconds?: number;
    env_vars?: Record<string, string>;
  },
): Promise<ExecResult> {
  if (isTauri()) {
    return tauriInvoke<ExecResult>("local_ar_execute", {
      runId,
      command: opts?.command ?? null,
      timeoutSeconds: opts?.timeout_seconds ?? null,
      envVars: opts?.env_vars ?? null,
    });
  }

  return autoresearchApi.execute(runId, opts);
}

/** Keep or discard the last iteration. */
export async function decide(
  runId: string,
  opts: {
    keep: boolean;
    iteration: number;
    commit_sha?: string;
    duration?: number;
    exit_code?: number;
    extra_metrics?: Record<string, number>;
  },
): Promise<DecideResult> {
  if (isTauri()) {
    return tauriInvoke<DecideResult>("local_ar_decide", {
      runId,
      keep: opts.keep,
      iteration: opts.iteration,
      commitSha: opts.commit_sha ?? null,
      duration: opts.duration ?? null,
      exitCode: opts.exit_code ?? null,
      extraMetrics: opts.extra_metrics ?? null,
    });
  }

  return autoresearchApi.decide(runId, opts);
}

/** Write a file without git commit (for output docs, logs, etc.). */
export async function writeFile(
  runId: string,
  path: string,
  content: string,
): Promise<void> {
  if (isTauri()) {
    await tauriInvoke("local_ar_write_file", { runId, path, content });
    return;
  }

  // Fallback: use workspace API
  const { workspaceApi } = await import("./api");
  await workspaceApi.createFile(runId, path, content);
}

/** Read a file from the workspace. */
export async function readFile(runId: string, path: string): Promise<string> {
  if (isTauri()) {
    return tauriInvoke<string>("local_ar_read_file", { runId, path });
  }

  return autoresearchApi.readCode(runId, path).then((r) => r.content ?? "");
}

/** List tracked files in the workspace. */
export async function listFiles(runId: string): Promise<string[]> {
  if (isTauri()) {
    return tauriInvoke<string[]>("local_ar_list_files", { runId });
  }

  const status = await autoresearchApi.getStatus(runId);
  return status.files;
}

/** Get git log. */
export async function gitLog(
  runId: string,
  limit = 50,
): Promise<Array<{ sha: string; message: string; date: string; files_changed: string[] }>> {
  if (isTauri()) {
    return tauriInvoke("local_ar_git_log", { runId, limit });
  }

  const status = await autoresearchApi.getStatus(runId);
  return status.recent_commits;
}

/** Check if running in local execution mode (Tauri). */
export function getExecMode(): "local" | "server" {
  return isTauri() ? "local" : "server";
}
