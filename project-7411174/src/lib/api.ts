/**
 * StudyHub API Client
 * Handles all HTTP requests to the backend with JWT auth and auto-refresh.
 */

import { fetchCitationNetwork, networkToLegacyResponse } from "./citation-fetcher";

const API_URL = import.meta.env.VITE_API_URL || "http://101.126.141.165/api";

// ── Token Management ─────────────────────────────────────────────

function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

// ── Refresh Lock (prevent concurrent refreshes) ──────────────────

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.success && data.data) {
        setTokens(data.data.access_token, data.data.refresh_token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── Core Fetch ───────────────────────────────────────────────────

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { skipAuth, ...fetchOpts } = opts;
  const headers = new Headers(fetchOpts.headers);

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    fetchOpts.body &&
    typeof fetchOpts.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  let res = await fetch(url, { ...fetchOpts, headers });

  // Auto-refresh on 401
  if (res.status === 401 && !skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${getAccessToken()}`);
      res = await fetch(url, { ...fetchOpts, headers });
    } else {
      clearTokens();
      throw new Error("请先登录");
    }
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    // Handle FastAPI validation errors (detail is array)
    let errMsg: string;
    if (Array.isArray(errBody.detail)) {
      errMsg = errBody.detail.map((d: { msg?: string; loc?: string[] }) =>
        d.msg || JSON.stringify(d)
      ).join("; ");
    } else {
      errMsg = errBody.error || errBody.detail || errBody.message || `请求失败 (${res.status})`;
    }
    throw new Error(errMsg);
  }

  return res.json();
}

// ── API Response Envelope ────────────────────────────────────────
// Backend wraps most responses in { success, data, error, message }

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch<ApiResponse<T>>(path);
  if (!res.success) throw new Error(res.error || "API error");
  return res.data;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch<ApiResponse<T>>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.success) throw new Error(res.error || "API error");
  return res.data;
}

async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch<ApiResponse<T>>(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.success) throw new Error(res.error || "API error");
  return res.data;
}

async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch<ApiResponse<T>>(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.success) throw new Error(res.error || "API error");
  return res.data;
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await apiFetch<ApiResponse<T>>(path, { method: "DELETE" });
  if (!res.success) throw new Error(res.error || "API error");
  return res.data;
}

// ── Auth API ─────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; name?: string };
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const res = await apiFetch<ApiResponse<{ access_token: string; refresh_token: string; token_type?: string }>>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
    if (!res.success) throw new Error(res.error || "登录失败，请检查邮箱和密码");
    setTokens(res.data.access_token, res.data.refresh_token);
    // Fetch user info after login
    const user = await authApi.me();
    return { ...res.data, user };
  },

  register: async (
    email: string,
    password: string,
    name?: string,
    extra?: {
      invite_code?: string;
      institution?: string;
      major?: string;
      advisor?: string;
      role?: string;
      research_directions?: string[];
    }
  ): Promise<LoginResponse> => {
    // Step 1: Register (backend uses full_name, no token returned)
    const regRes = await apiFetch<ApiResponse<{ id: string; email: string }>>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        full_name: name || email.split("@")[0],
        invite_code: extra?.invite_code || "",
        institution: extra?.institution,
        major: extra?.major,
        advisor: extra?.advisor,
        role: extra?.role,
        research_directions: extra?.research_directions,
      }),
      skipAuth: true,
    });
    if (!regRes.success) throw new Error(regRes.error || "注册失败，该邮箱可能已被使用");
    // Step 2: Auto-login after registration
    return authApi.login(email, password);
  },

  uploadPapers: async (files: File[]): Promise<{ extracted_keywords: string[]; paper_titles: string[]; total_files: number }> => {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    const res = await apiFetch<ApiResponse<{ extracted_keywords: string[]; paper_titles: string[]; total_files: number }>>("/auth/upload-papers", {
      method: "POST",
      body: formData,
      // Don't set Content-Type — browser will set multipart boundary
    });
    if (!res.success) throw new Error(res.error || "上传失败");
    return res.data;
  },

  logout: async () => {
    try {
      const refresh = getRefreshToken();
      if (refresh) {
        await apiFetch("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refresh }),
        });
      }
    } catch {
      // Ignore logout errors — tokens cleared client-side regardless
    } finally {
      clearTokens();
    }
  },

  me: async (): Promise<{ id: string; email: string; name?: string }> => {
    const res = await apiFetch<ApiResponse<{ id: string; email: string; full_name?: string; name?: string }>>("/auth/me");
    if (!res.success) throw new Error(res.error || "获取用户信息失败");
    return { id: res.data.id, email: res.data.email, name: res.data.full_name || res.data.name };
  },
};

// ── Paper Search API ─────────────────────────────────────────────
// GET /search/papers?q=xxx — uses envelope response {success, data: {papers, total, ...}}

export interface PaperResult {
  id?: string;
  doi?: string;
  arxiv_id?: string;
  s2_id?: string;
  openalex_id?: string;
  pmid?: string;
  title: string;
  abstract?: string;
  authors: string[];
  year?: number;
  venue?: string;
  citation_count: number;
  pdf_url?: string;
  is_open_access: boolean;
  sources: string[];
  language?: string;
}

export interface SearchResponse {
  papers: PaperResult[];
  total: number;
  sources_queried: string[];
  sources_failed: string[];
  from_cache: boolean;
}

export const papersApi = {
  search: async (params: {
    query: string;
    limit?: number;
    offset?: number;
    year_from?: number;
    year_to?: number;
    sources?: string[];
    sort_by?: string;
  }): Promise<SearchResponse> => {
    const qs = new URLSearchParams();
    // Backend uses "q" not "query"
    qs.set("q", params.query);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    if (params.year_from) qs.set("year_from", String(params.year_from));
    if (params.year_to) qs.set("year_to", String(params.year_to));
    if (params.sources) qs.set("sources", params.sources.join(","));
    if (params.sort_by) qs.set("sort_by", params.sort_by);
    // Response is wrapped in envelope: {success, data: {papers, total, ...}}
    return apiGet<SearchResponse>(`/search/papers?${qs.toString()}`);
  },

  getDetail: (paperId: string) =>
    apiGet<PaperResult>(`/papers/${paperId}`),

  getCitations: async (paperId: string): Promise<PaperCitationsResponse> => {
    // Try backend first (may work if server IP not rate-limited)
    try {
      const backendResult = await apiGet<PaperCitationsResponse>(`/papers/${paperId}/citations`);
      if (
        backendResult.references.length > 0 &&
        backendResult.references[0].title &&
        !backendResult.references[0].title.startsWith("Referenced Work")
      ) {
        return backendResult;
      }
    } catch {
      // Backend failed, proceed to browser-side fetch
    }

    // Browser-side: use citation-fetcher (OpenAlex → S2 fallback)
    const paper = await papersApi.getDetail(paperId);
    const network = await fetchCitationNetwork({
      openalexId: paper.openalex_id ?? undefined,
      doi: paper.doi ?? undefined,
    });
    if (!network) {
      return { references: [], cited_by: [], abstract: null, total_references: 0, total_cited_by: 0 };
    }
    return networkToLegacyResponse(network);
  },
};

export interface CitedPaper {
  openalex_id: string;
  title: string;
  year?: number;
  citation_count: number;
  authors: string[];
  venue: string;
}

export interface PaperCitationsResponse {
  references: CitedPaper[];
  cited_by: CitedPaper[];
  abstract: string | null;
  total_references: number;
  total_cited_by: number;
}

// ── Deep Research API ────────────────────────────────────────────

export interface DeepResearchTask {
  id: string;
  user_id: string;
  workflow_id: string;
  research_direction: string;
  entry_type: "direction" | "paper" | "author";
  status: "pending" | "running" | "completed" | "failed";
  papers_found: number;
  papers_analyzed: number;
  total_cost: number;
  created_at: string;
  completed_at: string | null;
}

export interface DeepResearchCreateInput {
  research_direction: string;
  entry_type?: "direction" | "paper" | "author";
  depth?: number;
  max_papers?: number;
  sources?: string[];
  year_from?: number;
  year_to?: number;
  languages?: string[];
}

/** WebSocket progress message shape */
export interface DeepResearchProgress {
  phase: string;
  papers_found: number;
  papers_analyzed: number;
  total_papers: number;
  current_activity: string;
  eta_seconds: number | null;
  error: string | null;
}

export const researchApi = {
  create: (input: DeepResearchCreateInput) =>
    apiPost<DeepResearchTask>("/v1/deep-research/tasks", input),

  list: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    return apiGet<DeepResearchTask[]>(`/v1/deep-research/tasks?${qs.toString()}`);
  },

  get: (taskId: string) =>
    apiGet<DeepResearchTask>(`/v1/deep-research/tasks/${taskId}`),

  getReport: async (taskId: string): Promise<string> => {
    const res = await apiFetch<string>(`/v1/deep-research/tasks/${taskId}/report`);
    // Report endpoint returns plain text/markdown
    return typeof res === "string" ? res : JSON.stringify(res);
  },

  wsUrl: (taskId: string): string => {
    const token = getAccessToken();
    const base = API_URL.replace("http", "ws");
    return `${base}/v1/deep-research/tasks/${taskId}/ws?token=${token ?? ""}`;
  },
};

// ── Plans API ────────────────────────────────────────────────────

export interface PlanResponse {
  id: string;
  title: string;
  description?: string;
  status: string;
  hypothesis?: string;
  methodology?: string;
  feasibility_score?: number;
  created_at: string;
  updated_at: string;
}

export const plansApi = {
  list: () => apiGet<PlanResponse[]>("/v1/plans/"),
  get: (planId: string) => apiGet<PlanResponse>(`/v1/plans/${planId}`),
  create: (data: { title: string; hypothesis: string; method_description: string; datasets?: string[]; difficulty?: string; estimated_time?: string; direction?: string }) =>
    apiPost<PlanResponse>("/v1/plans/", data),
  generate: (input: Record<string, unknown>) =>
    apiPost<PlanResponse[]>("/v1/plans/generate", input),
  update: (planId: string, data: Record<string, unknown>) =>
    apiPatch<PlanResponse>(`/v1/plans/${planId}`, data),
  delete: (planId: string) => apiDelete(`/v1/plans/${planId}`),
  approve: (planId: string) =>
    apiPost<PlanResponse>(`/v1/plans/${planId}/approve`),
};

// ── Experiments API ──────────────────────────────────────────────

export interface ExperimentRun {
  id: string;
  plan_id: string;
  status: string;
  gpu_device?: number;
  max_rounds?: number;
  current_round?: number;
  metrics?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const experimentsApi = {
  list: () => apiGet<ExperimentRun[]>("/v1/experiments/"),
  get: (runId: string) => apiGet<ExperimentRun>(`/v1/experiments/${runId}`),
  create: (data: Record<string, unknown>) =>
    apiPost<ExperimentRun>("/v1/experiments/", data),
  cancel: (runId: string) =>
    apiPost(`/v1/experiments/${runId}/cancel`),
  getReport: (runId: string) =>
    apiGet<Record<string, unknown>>(`/v1/experiments/${runId}/report`),
};

// ── Scholars API ─────────────────────────────────────────────────
// GET /scholars/ returns envelope: {success, data: {scholars: [], total: 0}}

export interface ScholarResponse {
  id: string;
  name: string;
  name_en?: string;
  institution?: string;
  title?: string | string[];
  rank?: string;
  birth_year?: number;
  h_index?: number;
  total_citations?: number;
  research_fields?: string[];
  honors?: string[];
  education?: Record<string, string>;
  note?: string;
  linked_paper_ids?: string[];
  source_urls?: { url: string; label?: string }[];
  // Aliases from older code paths
  research_directions?: string[];
  expertise?: string[];
  citation_count?: number;
}

export interface ScholarListResult {
  scholars: ScholarResponse[];
  total: number;
}

export const scholarsApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    name?: string;
    institution?: string;
    research_field?: string;
  }): Promise<ScholarListResult> => {
    const qs = new URLSearchParams();
    qs.set("limit", String(params?.limit ?? 100));
    if (params?.page) qs.set("page", String(params.page));
    if (params?.name) qs.set("name", params.name);
    if (params?.institution) qs.set("institution", params.institution);
    if (params?.research_field) qs.set("research_field", params.research_field);
    return apiGet<ScholarListResult>(`/scholars/?${qs.toString()}`);
  },
  get: (id: string) => apiGet<ScholarResponse>(`/scholars/${id}`),
  follow: (scholarId: string) => apiPost<{ following: boolean }>(`/scholars/${scholarId}/follow`, {}),
  unfollow: (scholarId: string) => apiDelete<{ following: boolean }>(`/scholars/${scholarId}/follow`),
  isFollowing: (scholarId: string) => apiGet<{ following: boolean }>(`/scholars/${scholarId}/is-following`),
  listFollowing: async (params?: { page?: number; limit?: number }): Promise<ScholarListResult> => {
    const qs = new URLSearchParams();
    qs.set("limit", String(params?.limit ?? 50));
    if (params?.page) qs.set("page", String(params.page));
    return apiGet<ScholarListResult>(`/scholars/following/list?${qs.toString()}`);
  },
};

// ── Community API ────────────────────────────────────────────────

export interface ResearchNeed {
  id: string;
  title: string;
  description?: string;
  direction?: string;
  status: string;
  skills?: string[];
  created_at: string;
}

export interface MatchResult {
  profile_id: string;
  score: number;
  name?: string;
  institution?: string;
  research_directions?: string[];
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

export const communityApi = {
  // Needs
  listNeeds: () => apiGet<ResearchNeed[]>("/v1/needs/"),
  createNeed: (data: Record<string, unknown>) =>
    apiPost<ResearchNeed>("/v1/needs/", data),

  // Matching
  getRecommendations: () =>
    apiGet<MatchResult[]>("/v1/matching/recommendations"),

  // Messages
  listConversations: () =>
    apiGet<Record<string, unknown>[]>("/v1/messages/conversations"),
  getConversation: (userId: string) =>
    apiGet<Message[]>(`/v1/messages/conversations/${userId}`),
  sendMessage: (data: { receiver_id: string; content: string }) =>
    apiPost<Message>("/v1/messages/", data),
  getUnreadCount: () =>
    apiGet<{ count: number }>("/v1/messages/unread"),
};

// ── Reading Lists API ────────────────────────────────────────────

export interface ReadingListResponse {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  paper_ids: string[];
  created_at: string;
  updated_at: string;
}

export const readingListsApi = {
  list: () => apiGet<ReadingListResponse[]>("/reading-lists"),
  get: (id: string) => apiGet<ReadingListResponse>(`/reading-lists/${id}`),
  create: (data: { name: string; description?: string }) =>
    apiPost<ReadingListResponse>("/reading-lists", data),
  update: (listId: string, data: { name?: string; description?: string; paper_ids?: string[] }) =>
    apiPut<ReadingListResponse>(`/reading-lists/${listId}`, data),
  addPaper: (listId: string, paperId: string) =>
    apiPost<ReadingListResponse>(`/reading-lists/${listId}/papers`, { paper_id: paperId }),
  removePaper: (listId: string, paperId: string) =>
    apiDelete<ReadingListResponse>(`/reading-lists/${listId}/papers/${paperId}`),
  delete: (listId: string) =>
    apiDelete(`/reading-lists/${listId}`),
};

// ── Profiles API ─────────────────────────────────────────────────

export interface ProfileResponse {
  id: string;
  user_id: string;
  name: string;
  institution?: string;
  title?: string;
  bio?: string;
  h_index?: number;
  citation_count?: number;
  paper_count?: number;
  research_directions?: string[];
  expertise?: string[];
}

export const profilesApi = {
  getMe: () => apiGet<ProfileResponse>("/v1/profiles/me"),
  createMe: (data: {
    display_name: string;
    institution?: string;
    title?: string;
    research_directions?: string[];
    expertise_tags?: string[];
  }) => apiPost<ProfileResponse>("/v1/profiles/", data),
  updateMe: (data: Record<string, unknown>) =>
    apiPatch<ProfileResponse>("/v1/profiles/me", data),
  getPublic: (profileId: string) =>
    apiGet<ProfileResponse>(`/v1/profiles/${profileId}`),
};

// ── Citations API ────────────────────────────────────────────────

export const citationsApi = {
  getGraph: (paperId: string) =>
    apiGet<Record<string, unknown>>(`/citations/graph/${paperId}`),
  expand: (data: { paper_ids: string[]; depth?: number }) =>
    apiPost<Record<string, unknown>>("/citations/expand", data),
};

// ── LLM API ──────────────────────────────────────────────────────
// POST /llm/completion — requires auth, uses {messages} format

export const llmApi = {
  completion: async (data: { prompt: string; model?: string }): Promise<{ content: string }> => {
    const res = await apiFetch<ApiResponse<{ content: string }>>("/llm/completion", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: data.prompt }],
        model: data.model,
      }),
    });
    if (!res.success) throw new Error(res.error || "LLM error");
    return res.data;
  },
};

// ── Agent Runtime API ────────────────────────────────────────────

export interface AgentSkill {
  name: string;
  display_name: string;
  description: string;
  output_format: string;
}

export interface AgentRunResponse {
  id: string;
  user_id: string;
  skill_name: string;
  task_id: string | null;
  status: string;
  plan: AgentPlan | null;
  total_cost: number;
  total_steps: number;
  output_format: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface AgentPlan {
  goal: string;
  steps: AgentPlanStep[];
  estimated_sections: number;
}

export interface AgentPlanStep {
  id: number;
  description: string;
  tool: string | null;
  args: Record<string, unknown>;
}

export interface AgentLogEntry {
  id: number;
  event_type: string;
  step_number: number | null;
  message: string | null;
  data: Record<string, unknown> | null;
  timestamp: string;
}

/** WebSocket event from agent execution */
export interface AgentWsEvent {
  event_type: string;
  message: string;
  data?: Record<string, unknown>;
  step?: number;
}

export const agentApi = {
  listSkills: () =>
    apiGet<AgentSkill[]>("/v1/agent/skills"),

  createRun: (data: { skill_name: string; task_id?: string; auto_approve?: boolean }) =>
    apiPost<AgentRunResponse>("/v1/agent/runs", data),

  approveRun: (runId: string) =>
    apiPost<AgentRunResponse>(`/v1/agent/runs/${runId}/approve`),

  rejectRun: (runId: string) =>
    apiPost<AgentRunResponse>(`/v1/agent/runs/${runId}/reject`),

  getRun: (runId: string) =>
    apiGet<AgentRunResponse>(`/v1/agent/runs/${runId}`),

  getOutput: (runId: string) =>
    apiGet<{ content: string; format: string; length: number }>(`/v1/agent/runs/${runId}/output`),

  getLogs: (runId: string, params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    return apiGet<AgentLogEntry[]>(`/v1/agent/runs/${runId}/logs?${qs.toString()}`);
  },

  listRuns: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    return apiGet<AgentRunResponse[]>(`/v1/agent/runs?${qs.toString()}`);
  },

  wsUrl: (runId: string): string => {
    const token = getAccessToken();
    const base = API_URL.replace("http", "ws");
    return `${base}/v1/agent/runs/${runId}/ws?token=${token ?? ""}`;
  },
};

// ── Workspace API ────────────────────────────────────────────────

export interface WorkspaceFile {
  path: string;
  type: "file" | "dir";
  size: number;
  modified: string | null;
}

export interface GitCommit {
  sha: string;
  message: string;
  date: string;
  author: string;
  files_changed: string[];
}

export interface GitDiff {
  path: string;
  old_content: string | null;
  new_content: string | null;
}

export const workspaceApi = {
  getTree: (taskId: string) =>
    apiGet<WorkspaceFile[]>(`/v1/workspaces/${taskId}/tree`),

  getFile: (taskId: string, path: string) =>
    apiGet<{ content: string; path: string }>(`/v1/workspaces/${taskId}/files/${path}`),

  updateFile: (taskId: string, path: string, content: string, commitMessage?: string) =>
    apiPut<{ commit_sha: string }>(`/v1/workspaces/${taskId}/files/${path}`, {
      content, commit_message: commitMessage,
    }),

  createFile: (taskId: string, path: string, content: string) =>
    apiPost<{ commit_sha: string }>(`/v1/workspaces/${taskId}/files`, { path, content }),

  deleteFile: (taskId: string, path: string) =>
    apiDelete<{ commit_sha: string }>(`/v1/workspaces/${taskId}/files/${path}`),

  getGitLog: (taskId: string, limit = 50) =>
    apiGet<GitCommit[]>(`/v1/workspaces/${taskId}/git/log?limit=${limit}`),

  getGitDiff: (taskId: string, fromSha: string, toSha: string) =>
    apiGet<GitDiff[]>(`/v1/workspaces/${taskId}/git/diff?from_sha=${fromSha}&to_sha=${toSha}`),

  getFileAtCommit: (taskId: string, sha: string, path: string) =>
    apiGet<{ content: string }>(`/v1/workspaces/${taskId}/git/show/${sha}/${path}`),
};

// ── AutoResearch API ─────────────────────────────────────────────
// Karpathy-style real code execution with git versioning

export interface AutoResearchRunStatus {
  exists: boolean;
  run_id: string;
  files: string[];
  recent_commits: GitCommit[];
  total_iterations: number;
  results: Record<string, string>[];
}

export interface AutoResearchExecuteResult {
  exit_code: number;
  duration_seconds: number;
  stdout: string;
  stderr: string;
  metrics: Record<string, number>;
  error: string | null;
}

export const autoresearchApi = {
  /** Initialize a new run workspace with optional base code */
  initRun: (data: {
    base_code?: string;
    prepare_code?: string;
    requirements?: string;
    run_id?: string;
  }) => apiPost<{ run_id: string; workspace_path: string }>("/v1/autoresearch/runs", data),

  /** Write code to workspace and git commit */
  writeCode: (runId: string, path: string, content: string, message?: string) =>
    apiPost<{ commit_sha: string; path: string }>(
      `/v1/autoresearch/runs/${runId}/code`,
      { path, content, message },
    ),

  /** Execute a command in the workspace (real subprocess) */
  execute: (runId: string, data?: {
    command?: string;
    timeout_seconds?: number;
    env_vars?: Record<string, string>;
  }) => apiPost<AutoResearchExecuteResult>(
    `/v1/autoresearch/runs/${runId}/execute`,
    data ?? {},
  ),

  /** Keep or discard last iteration (git reset --hard HEAD~1 for discard) */
  decide: (runId: string, data: {
    keep: boolean;
    iteration: number;
    commit_sha?: string;
    duration?: number;
    exit_code?: number;
    extra_metrics?: Record<string, number>;
  }) => apiPost<{ head_sha: string; action: string }>(
    `/v1/autoresearch/runs/${runId}/decide`,
    data,
  ),

  /** Get run status */
  getStatus: (runId: string) =>
    apiGet<AutoResearchRunStatus>(`/v1/autoresearch/runs/${runId}`),

  /** Read current code file */
  readCode: (runId: string, path = "train.py") =>
    apiGet<{ path: string; content: string | null }>(
      `/v1/autoresearch/runs/${runId}/code/${path}`,
    ),

  /** Install Python dependencies */
  installDeps: (runId: string) =>
    apiPost<AutoResearchExecuteResult>(`/v1/autoresearch/runs/${runId}/install`, {}),
};

export { API_URL };
