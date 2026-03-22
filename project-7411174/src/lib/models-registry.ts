/**
 * Models registry — fetches provider/model data from models.dev.
 * Caches in memory and localStorage for fast subsequent loads.
 */

const MODELS_API_URL = "https://models.dev/api.json";
const CACHE_KEY = "studyhub_models_registry";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface ModelInfo {
  id: string;
  name: string;
  family?: string;
  reasoning?: boolean;
  toolCall?: boolean;
  contextLimit: number;
  outputLimit: number;
  costInput: number;
  costOutput: number;
  modalities?: { input?: string[]; output?: string[] };
}

export interface ProviderInfo {
  id: string;
  name: string;
  apiBase: string;
  models: ModelInfo[];
}

interface RawModel {
  id: string;
  name: string;
  family?: string;
  reasoning?: boolean;
  tool_call?: boolean;
  limit?: { context?: number; output?: number };
  cost?: { input?: number; output?: number };
  modalities?: { input?: string[]; output?: string[] };
}

interface RawProvider {
  id: string;
  name: string;
  api: string;
  models: Record<string, RawModel>;
}

let memoryCache: ProviderInfo[] | null = null;

function parseProviders(raw: RawProvider[]): ProviderInfo[] {
  return raw
    .filter((p) => p.api && p.models && Object.keys(p.models).length > 0)
    .map((p) => ({
      id: p.id,
      name: p.name || p.id,
      apiBase: p.api,
      models: Object.values(p.models)
        .filter((m) => m.id && m.name)
        .map((m) => ({
          id: m.id,
          name: m.name,
          family: m.family,
          reasoning: m.reasoning,
          toolCall: m.tool_call,
          contextLimit: m.limit?.context ?? 0,
          outputLimit: m.limit?.output ?? 0,
          costInput: m.cost?.input ?? 0,
          costOutput: m.cost?.output ?? 0,
          modalities: m.modalities,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function loadFromLocalStorage(): ProviderInfo[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL_MS) return null;
    return data as ProviderInfo[];
  } catch {
    return null;
  }
}

function saveToLocalStorage(data: ProviderInfo[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

/**
 * Fetch all providers and their models.
 * Uses memory cache → localStorage cache → network fetch.
 */
export async function getProviders(): Promise<ProviderInfo[]> {
  if (memoryCache) return memoryCache;

  const cached = loadFromLocalStorage();
  if (cached) {
    memoryCache = cached;
    return cached;
  }

  const resp = await fetch(MODELS_API_URL);
  if (!resp.ok) throw new Error(`Failed to fetch models registry: ${resp.status}`);

  const json = await resp.json();
  const raw: RawProvider[] = Array.isArray(json) ? json : Object.values(json);
  const providers = parseProviders(raw);

  memoryCache = providers;
  saveToLocalStorage(providers);

  return providers;
}

/**
 * Find a model by its ID across all providers.
 */
export function findModel(providers: ProviderInfo[], modelId: string): { provider: ProviderInfo; model: ModelInfo } | null {
  for (const provider of providers) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) return { provider, model };
  }
  return null;
}

/**
 * Invalidate cache and refetch.
 */
export function clearModelsCache(): void {
  memoryCache = null;
  localStorage.removeItem(CACHE_KEY);
}
