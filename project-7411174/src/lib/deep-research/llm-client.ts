/**
 * Client-side LLM client — proxies through backend to avoid CORS.
 * Frontend → our backend /llm/proxy → user's LLM API
 *
 * Includes token estimation and budget management.
 */

import type { LLMConfig } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Rough token estimation: ~4 chars per token for English, ~2 chars per CJK token.
 * This is intentionally conservative (overestimates) to prevent context overflow.
 */
export function estimateTokens(text: string): number {
  // Count CJK characters (higher token density)
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f]/g) || []).length;
  const nonCjk = text.length - cjk;
  return Math.ceil(cjk / 1.5 + nonCjk / 4);
}

/**
 * Calculate safe max_tokens for output given input size and model context limit.
 * Reserves 20% margin for safety.
 */
export function calcOutputBudget(
  inputTokens: number,
  maxContextTokens: number,
  desiredOutput: number,
): number {
  const safeContext = Math.floor(maxContextTokens * 0.8); // 20% safety margin
  const available = safeContext - inputTokens;
  if (available <= 0) return 512; // minimum fallback
  return Math.min(desiredOutput, available);
}

/**
 * Fetch model info (max context tokens) from models.dev registry.
 * Falls back to localStorage config or default 32000.
 */
export async function fetchModelMaxTokens(config: LLMConfig): Promise<number> {
  try {
    const { getProviders, findModel } = await import("../models-registry");
    const providers = await getProviders();
    const result = findModel(providers, config.model);
    if (result && result.model.contextLimit > 0) return result.model.contextLimit;
  } catch { /* ignore */ }

  return config.maxContextTokens || 32000;
}

/**
 * Call LLM via backend proxy to avoid browser CORS restrictions.
 * Automatically manages token budget based on model context limits.
 */
export async function chatCompletion(
  config: LLMConfig,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const { apiBase, apiKey, model } = config;

  if (!apiBase || !apiKey || !model) {
    throw new Error("LLM 未配置。请在设置页面配置 API Key、API Base 和模型名称。");
  }

  // Estimate input tokens and calculate safe output budget
  const inputText = messages.map(m => m.content).join(" ");
  const inputTokens = estimateTokens(inputText);
  const maxContext = config.maxContextTokens || 32000;
  const desiredOutput = options?.maxTokens ?? 4096;
  const safeMaxTokens = calcOutputBudget(inputTokens, maxContext, desiredOutput);

  const resp = await fetch(`${API_URL}/llm/proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_base: apiBase,
      api_key: apiKey,
      model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: safeMaxTokens,
      stream: false,
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`LLM API 错误 (${resp.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 返回空内容");
  // Strip <think>...</think> reasoning blocks (DeepSeek, MiniMax, etc.)
  const stripped = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (stripped) return stripped;
  // If everything was inside <think> tags, extract the content from inside them
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    // Try to find JSON or code inside the think block
    const inner = thinkMatch[1].trim();
    const jsonMatch = inner.match(/\{[\s\S]*\}/);
    if (jsonMatch) return jsonMatch[0];
    const codeMatch = inner.match(/```(?:python|json)?\s*\n([\s\S]*?)```/);
    if (codeMatch) return codeMatch[1].trim();
    // Last resort: return the think content itself
    return inner;
  }
  return content.trim();
}

/**
 * Parse JSON from LLM response.
 * Handles: <think> blocks, markdown code fences, mixed text around JSON.
 */
export function parseJsonResponse<T>(raw: string): T {
  // 1. Strip <think>...</think> reasoning blocks (MiniMax, DeepSeek, etc.)
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Strip markdown code fences
  cleaned = cleaned
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  // 3. Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // 4. Try to extract JSON array or object from mixed text
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]); } catch { /* fall through */ }
    }
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
    }
    throw new Error(`无法解析 LLM 返回的 JSON: ${cleaned.slice(0, 100)}...`);
  }
}
