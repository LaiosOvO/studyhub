/**
 * Shared status badge utilities used across Plans, Experiments, and other pages.
 * Centralizes color/label mappings to avoid duplication.
 */

// ── Plan status ──────────────────────────────────────────────────────────────
export type PlanStatus = "draft" | "ready" | "running" | "completed";

export interface PlanStatusConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const PLAN_STATUS: Record<PlanStatus, PlanStatusConfig> = {
  draft:     { label: "草稿",  color: "text-[#475569]",  bg: "bg-white/[0.05]",    border: "border-white/[0.1]" },
  ready:     { label: "待执行", color: "text-amber-400",  bg: "bg-amber-400/10",    border: "border-amber-400/20" },
  running:   { label: "执行中", color: "text-[#00D4B8]",  bg: "bg-[#00D4B8]/10",   border: "border-[#00D4B8]/20" },
  completed: { label: "已完成", color: "text-green-400",  bg: "bg-green-400/10",    border: "border-green-400/20" },
};

// ── Experiment status ────────────────────────────────────────────────────────
export type ExperimentStatus = "running" | "queued" | "completed" | "failed" | "paused";

export interface ExperimentStatusConfig {
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}

export const EXPERIMENT_STATUS: Record<ExperimentStatus, ExperimentStatusConfig> = {
  running:   { label: "运行中", icon: "ri-loader-4-line",      color: "text-[#00D4B8]",  bg: "bg-[#00D4B8]/10",  border: "border-[#00D4B8]/20" },
  queued:    { label: "排队中", icon: "ri-time-line",           color: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/20" },
  completed: { label: "已完成", icon: "ri-check-circle-line",   color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/20" },
  failed:    { label: "失败",   icon: "ri-close-circle-line",   color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/20" },
  paused:    { label: "已暂停", icon: "ri-pause-circle-line",   color: "text-[#475569]",  bg: "bg-white/[0.05]",  border: "border-white/[0.1]" },
};

// ── Generic status badge renderer ────────────────────────────────────────────
interface StatusBadgeProps {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon?: string;
  spinning?: boolean;
  size?: "sm" | "md";
}

export function buildStatusBadgeClass({ color, bg, border, size = "md" }: Pick<StatusBadgeProps, "color" | "bg" | "border" | "size">) {
  const base = "inline-flex items-center gap-1.5 font-medium rounded-full";
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return `${base} ${padding} ${color} ${bg} border ${border}`;
}
