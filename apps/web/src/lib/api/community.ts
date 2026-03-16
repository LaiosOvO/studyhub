/**
 * API client for community collaboration features.
 *
 * Provides typed functions for profiles, matching, needs, and messaging.
 */

import { apiFetch } from '../api';

// ─── TypeScript Interfaces ──────────────────────────────────────────────

export interface ResearcherProfile {
  readonly id: string;
  readonly user_id: string;
  readonly display_name: string;
  readonly institution: string | null;
  readonly title: string | null;
  readonly research_directions: readonly string[];
  readonly expertise_tags: readonly string[];
  readonly h_index: number | null;
  readonly total_citations: number | null;
  readonly publication_count: number | null;
  readonly publications: readonly Record<string, unknown>[];
  readonly co_authors: readonly string[];
  readonly research_keywords: readonly string[];
  readonly enrichment_status: string;
  readonly created_at: string;
}

export interface ResearcherProfilePublic {
  readonly id: string;
  readonly display_name: string;
  readonly institution: string | null;
  readonly title: string | null;
  readonly research_directions: readonly string[];
  readonly expertise_tags: readonly string[];
  readonly h_index: number | null;
  readonly total_citations: number | null;
  readonly publication_count: number | null;
  readonly publications: readonly Record<string, unknown>[];
  readonly co_authors: readonly string[];
  readonly research_keywords: readonly string[];
}

export interface MatchSignalBreakdown {
  readonly complementarity: number;
  readonly co_citation: number;
  readonly adjacency: number;
  readonly institutional: number;
}

export interface MatchResult {
  readonly profile: ResearcherProfilePublic;
  readonly overall_score: number;
  readonly breakdown: MatchSignalBreakdown;
  readonly explanation: string | null;
}

export interface ResearchNeed {
  readonly id: string;
  readonly user_id: string;
  readonly title: string;
  readonly description: string;
  readonly required_skills: readonly string[];
  readonly research_direction: string | null;
  readonly tags: readonly string[];
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly match_score?: number;
}

export interface ResearchNeedCreate {
  readonly title: string;
  readonly description: string;
  readonly required_skills: readonly string[];
  readonly research_direction: string | null;
  readonly tags: readonly string[];
}

export interface ConversationListItem {
  readonly other_user_id: string;
  readonly other_user_name: string;
  readonly last_message: string;
  readonly last_message_at: string;
  readonly unread_count: number;
}

export interface MessageItem {
  readonly id: string;
  readonly sender_id: string;
  readonly recipient_id: string;
  readonly content: string;
  readonly read_at: string | null;
  readonly created_at: string;
}

// ─── Profile API ────────────────────────────────────────────────────────

export async function fetchMyProfile() {
  return apiFetch<ResearcherProfile>('/api/v1/profiles/me');
}

export async function createProfile(data: {
  display_name: string;
  institution?: string;
  title?: string;
  research_directions: string[];
  expertise_tags: string[];
}) {
  return apiFetch<ResearcherProfile>('/api/v1/profiles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProfile(data: Record<string, unknown>) {
  return apiFetch<ResearcherProfile>('/api/v1/profiles/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function fetchProfile(profileId: string) {
  return apiFetch<ResearcherProfilePublic>(`/api/v1/profiles/${profileId}`);
}

// ─── Matching API ───────────────────────────────────────────────────────

export async function fetchMatches() {
  return apiFetch<MatchResult[]>('/api/v1/matching/recommendations');
}

export async function fetchMatchExplanation(profileId: string) {
  return apiFetch<{ explanation: string }>(
    `/api/v1/matching/recommendations/${profileId}/explain`,
  );
}

// ─── Needs API ──────────────────────────────────────────────────────────

export async function fetchNeeds(params?: {
  q?: string;
  tags?: string;
  research_direction?: string;
  status?: string;
  sort_by?: string;
  skip?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    });
  }
  const query = searchParams.toString();
  return apiFetch<ResearchNeed[]>(`/api/v1/needs${query ? `?${query}` : ''}`);
}

export async function createNeed(data: ResearchNeedCreate) {
  return apiFetch<ResearchNeed>('/api/v1/needs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteNeed(needId: string) {
  return apiFetch<void>(`/api/v1/needs/${needId}`, { method: 'DELETE' });
}

// ─── Messages API ───────────────────────────────────────────────────────

export async function sendMessage(data: {
  recipient_id: string;
  content: string;
}) {
  return apiFetch<MessageItem>('/api/v1/messages', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchConversations() {
  return apiFetch<ConversationListItem[]>('/api/v1/messages/conversations');
}

export async function fetchConversation(
  otherUserId: string,
  skip = 0,
  limit = 50,
) {
  return apiFetch<MessageItem[]>(
    `/api/v1/messages/conversations/${otherUserId}?skip=${skip}&limit=${limit}`,
  );
}

export async function markConversationRead(otherUserId: string) {
  return apiFetch<{ marked_read: number }>(
    `/api/v1/messages/conversations/${otherUserId}/read`,
    { method: 'POST' },
  );
}

export async function fetchUnreadCount() {
  return apiFetch<{ unread_count: number }>('/api/v1/messages/unread');
}
