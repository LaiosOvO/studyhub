/**
 * Agent runtime type definitions.
 *
 * Reference: Kuse Cowork Plan→Step→Execute pattern,
 * LabClaw markdown skill definitions.
 */

export interface SkillDefinition {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string;
  category: SkillCategory;
  /** System prompt template — {variables} are replaced at runtime */
  systemPrompt: string;
  /** User prompt template */
  userPromptTemplate: string;
  /** Required input fields */
  inputs: SkillInput[];
  /** Output format */
  outputFormat: "markdown" | "json" | "text";
  /** Estimated LLM calls */
  estimatedCalls: number;
  /** Whether this is a built-in or user-defined skill */
  builtin: boolean;
  /** Whether this skill is enabled */
  enabled: boolean;
}

export type SkillCategory =
  | "literature"
  | "experiment"
  | "analysis"
  | "writing"
  | "translation"
  | "custom";

export interface SkillInput {
  key: string;
  label: string;
  labelZh: string;
  type: "text" | "textarea" | "select" | "number";
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

export interface AgentPlan {
  skillId: string;
  goal: string;
  steps: AgentStep[];
  estimatedTime: string;
}

export interface AgentStep {
  id: number;
  description: string;
  descriptionZh: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  output?: string;
  error?: string;
}

export type AgentEventType =
  | "plan_created"
  | "step_start"
  | "step_progress"
  | "step_done"
  | "step_failed"
  | "agent_done"
  | "agent_failed";

export interface AgentEvent {
  type: AgentEventType;
  stepId?: number;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface AgentRunState {
  skillId: string;
  inputs: Record<string, string>;
  plan: AgentPlan | null;
  events: AgentEvent[];
  status: "idle" | "planning" | "running" | "done" | "failed" | "cancelled";
  output: string | null;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
}
