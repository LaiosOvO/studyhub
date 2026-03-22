/**
 * Agent executor — runs skills via LLM.
 *
 * Plan→Step→Execute pattern (ref: Kuse Cowork).
 * All LLM calls use user's configured API key.
 */

import type { AgentEvent, AgentPlan, AgentRunState, AgentStep, SkillDefinition } from "./types";
import { chatCompletion, parseJsonResponse } from "../deep-research/llm-client";
import type { LLMConfig } from "../deep-research/types";

export type AgentEventCallback = (event: AgentEvent) => void;

/**
 * Create a fresh agent run state.
 */
export function createRunState(skillId: string, inputs: Record<string, string>): AgentRunState {
  return {
    skillId,
    inputs,
    plan: null,
    events: [],
    status: "idle",
    output: null,
    error: null,
    startedAt: null,
    completedAt: null,
  };
}

/**
 * Execute a skill with the given inputs.
 * Emits events for each step for real-time UI updates.
 */
export async function executeSkill(
  skill: SkillDefinition,
  inputs: Record<string, string>,
  llm: LLMConfig,
  onEvent: AgentEventCallback,
  signal?: AbortSignal,
): Promise<string> {
  const emit = (type: AgentEvent["type"], message: string, stepId?: number, data?: Record<string, unknown>) => {
    onEvent({
      type,
      stepId,
      message,
      data,
      timestamp: Date.now(),
    });
  };

  // ── Phase 1: Create Plan ──────────────────────────────────
  emit("plan_created", "正在制定执行计划...");

  const plan = buildPlan(skill, inputs);
  emit("plan_created", `计划已创建: ${plan.steps.length} 个步骤`, undefined, {
    plan: JSON.parse(JSON.stringify(plan)),
  });

  // ── Phase 2: Execute Steps ────────────────────────────────
  const outputs: string[] = [];

  for (let i = 0; i < plan.steps.length; i++) {
    if (signal?.aborted) throw new Error("用户取消了任务");

    const step = plan.steps[i];
    emit("step_start", `开始步骤 ${i + 1}: ${step.descriptionZh}`, step.id);

    try {
      const prompt = buildStepPrompt(skill, inputs, step, outputs);
      emit("step_progress", "正在调用 LLM...", step.id);

      const response = await chatCompletion(llm, prompt, {
        temperature: 0.4,
        maxTokens: step.id === plan.steps.length ? 8192 : 4096,
      });

      outputs.push(response);
      step.status = "done";
      step.output = response;

      emit("step_done", `步骤 ${i + 1} 完成`, step.id, {
        outputLength: response.length,
      });
    } catch (err) {
      step.status = "failed";
      step.error = err instanceof Error ? err.message : String(err);

      emit("step_failed", `步骤 ${i + 1} 失败: ${step.error}`, step.id);

      // Continue with remaining steps if possible
      if (i < plan.steps.length - 1) {
        outputs.push(`[步骤 ${i + 1} 失败，跳过]`);
        continue;
      }
      throw err;
    }
  }

  // ── Phase 3: Combine Output ───────────────────────────────
  const finalOutput = outputs[outputs.length - 1] || outputs.join("\n\n---\n\n");
  emit("agent_done", "任务完成！", undefined, { outputLength: finalOutput.length });

  return finalOutput;
}

/**
 * Build execution plan for a skill.
 */
function buildPlan(skill: SkillDefinition, inputs: Record<string, string>): AgentPlan {
  // Most skills are single-step (one LLM call)
  // Multi-step skills get split based on estimatedCalls
  const steps: AgentStep[] = [];

  if (skill.estimatedCalls <= 1) {
    steps.push({
      id: 1,
      description: `Execute ${skill.name}`,
      descriptionZh: `执行 ${skill.nameZh}`,
      status: "pending",
    });
  } else if (skill.id === "literature-review") {
    steps.push(
      { id: 1, description: "Generate outline", descriptionZh: "生成大纲结构", status: "pending" },
      { id: 2, description: "Write main sections", descriptionZh: "撰写主体内容", status: "pending" },
      { id: 3, description: "Write conclusion and polish", descriptionZh: "撰写结论并润色", status: "pending" },
    );
  } else if (skill.id === "experiment-plan") {
    steps.push(
      { id: 1, description: "Analyze problem and design", descriptionZh: "分析问题并设计实验", status: "pending" },
      { id: 2, description: "Detail implementation and timeline", descriptionZh: "细化实施计划和时间线", status: "pending" },
    );
  } else {
    // Default: split into planning + execution
    steps.push(
      { id: 1, description: "Analyze and plan", descriptionZh: "分析与规划", status: "pending" },
      { id: 2, description: "Generate output", descriptionZh: "生成结果", status: "pending" },
    );
  }

  return {
    skillId: skill.id,
    goal: interpolateTemplate(skill.userPromptTemplate, inputs).slice(0, 200),
    steps,
    estimatedTime: `${skill.estimatedCalls * 15}s`,
  };
}

/**
 * Build prompt messages for a specific step.
 */
function buildStepPrompt(
  skill: SkillDefinition,
  inputs: Record<string, string>,
  step: AgentStep,
  previousOutputs: string[],
): { role: "system" | "user"; content: string }[] {
  const systemPrompt = interpolateTemplate(skill.systemPrompt, inputs);
  const userPrompt = interpolateTemplate(skill.userPromptTemplate, inputs);

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  if (previousOutputs.length === 0) {
    // First step: use the full user prompt
    messages.push({ role: "user", content: userPrompt });
  } else {
    // Subsequent steps: include previous output as context
    const prevContext = previousOutputs
      .map((o, i) => `--- Step ${i + 1} Output ---\n${o}`)
      .join("\n\n");

    messages.push({
      role: "user",
      content: `Previous work:\n${prevContext}\n\nNow, continue with: ${step.descriptionZh}\n\nOriginal task:\n${userPrompt}`,
    });
  }

  return messages;
}

/**
 * Replace {key} placeholders in a template with input values.
 */
function interpolateTemplate(template: string, inputs: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(inputs)) {
    result = result.replaceAll(`{${key}}`, value || "");
  }
  // Remove unfilled placeholders
  result = result.replace(/\{[a-zA-Z_]+\}/g, "");
  return result;
}
