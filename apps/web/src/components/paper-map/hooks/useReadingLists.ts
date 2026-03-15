'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface ReadingListItem {
  readonly id: string;
  readonly user_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly paper_ids: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
}

interface UseReadingListsResult {
  readonly lists: readonly ReadingListItem[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly createList: (name: string, description?: string) => Promise<void>;
  readonly addPaper: (listId: string, paperId: string) => Promise<void>;
  readonly removePaper: (listId: string, paperId: string) => Promise<void>;
  readonly deleteList: (listId: string) => Promise<void>;
  readonly refresh: () => void;
}

/**
 * Hook for reading list CRUD operations via the backend API.
 * All mutations trigger a refresh to re-fetch the list.
 */
export function useReadingLists(): UseReadingListsResult {
  const [lists, setLists] = useState<readonly ReadingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchVersion, setFetchVersion] = useState(0);

  const refresh = useCallback(() => {
    setFetchVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchLists() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiFetch<ReadingListItem[]>(
          '/api/reading-lists',
        );

        if (cancelled) return;

        if (result.success) {
          setLists(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch reading lists',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchLists();

    return () => {
      cancelled = true;
    };
  }, [fetchVersion]);

  const createList = useCallback(
    async (name: string, description?: string) => {
      const result = await apiFetch<ReadingListItem>('/api/reading-lists', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      refresh();
    },
    [refresh],
  );

  const addPaper = useCallback(
    async (listId: string, paperId: string) => {
      const result = await apiFetch<ReadingListItem>(
        `/api/reading-lists/${listId}/papers`,
        {
          method: 'POST',
          body: JSON.stringify({ paper_id: paperId }),
        },
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      refresh();
    },
    [refresh],
  );

  const removePaper = useCallback(
    async (listId: string, paperId: string) => {
      const result = await apiFetch<ReadingListItem>(
        `/api/reading-lists/${listId}/papers/${paperId}`,
        {
          method: 'DELETE',
        },
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      refresh();
    },
    [refresh],
  );

  const deleteList = useCallback(
    async (listId: string) => {
      const result = await apiFetch<null>(
        `/api/reading-lists/${listId}`,
        {
          method: 'DELETE',
        },
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      refresh();
    },
    [refresh],
  );

  return {
    lists,
    isLoading,
    error,
    createList,
    addPaper,
    removePaper,
    deleteList,
    refresh,
  };
}
