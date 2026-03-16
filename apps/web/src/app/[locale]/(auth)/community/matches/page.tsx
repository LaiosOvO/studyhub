'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { MatchCard } from '@/components/community/MatchCard';
import type { MatchResult } from '@/lib/api/community';
import { fetchMatches } from '@/lib/api/community';

export default function MatchesPage() {
  const t = useTranslations('community');
  const router = useRouter();
  const [matches, setMatches] = useState<readonly MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchMatches();
      if (response.success) {
        setMatches(response.data);
      } else {
        setError(response.error);
      }
    } catch {
      setError('Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const handleViewProfile = useCallback(
    (profileId: string) => {
      router.push(`community/profile/${profileId}`);
    },
    [router],
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('matches.title')}
        </h1>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="h-64 animate-pulse rounded-lg bg-gray-100"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={loadMatches}
            className="mt-2 text-sm font-medium text-red-700 underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && matches.length === 0 && (
        <div className="rounded-lg border bg-gray-50 p-8 text-center">
          <p className="text-gray-500">{t('matches.empty')}</p>
        </div>
      )}

      {!loading && !error && matches.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <MatchCard
              key={match.profile.id}
              match={match}
              onViewProfile={handleViewProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
