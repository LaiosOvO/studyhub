'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { NeedCard } from '@/components/community/NeedCard';
import type { ResearchNeed } from '@/lib/api/community';
import { fetchNeeds } from '@/lib/api/community';

export default function NeedsPage() {
  const t = useTranslations('community');
  const router = useRouter();
  const [needs, setNeeds] = useState<readonly ResearchNeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'relevance'>('recent');
  const [statusFilter, setStatusFilter] = useState<'open' | ''>('open');

  const loadNeeds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchNeeds({
        q: search || undefined,
        status: statusFilter || undefined,
        sort_by: sortBy,
      });
      if (response.success) {
        setNeeds(response.data);
      } else {
        setError(response.error);
      }
    } catch {
      setError('Failed to load needs');
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, statusFilter]);

  useEffect(() => {
    loadNeeds();
  }, [loadNeeds]);

  const handleContact = useCallback(
    (userId: string) => {
      router.push(`/community/messages?to=${userId}`);
    },
    [router],
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('needs.title')}
        </h1>
        <button
          type="button"
          onClick={() => router.push('needs/create')}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          {t('needs.create')}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('needs.filter.search')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'recent' | 'relevance')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="recent">{t('needs.filter.sortRecent')}</option>
          <option value="relevance">{t('needs.filter.sortRelevance')}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'open' | '')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="open">{t('needs.filter.openOnly')}</option>
          <option value="">{t('needs.filter.allStatus')}</option>
        </select>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="h-48 animate-pulse rounded-lg bg-gray-100"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && needs.length === 0 && (
        <div className="rounded-lg border bg-gray-50 p-8 text-center">
          <p className="text-gray-500">{t('needs.empty')}</p>
        </div>
      )}

      {!loading && !error && needs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {needs.map((need) => (
            <NeedCard key={need.id} need={need} onContact={handleContact} />
          ))}
        </div>
      )}
    </div>
  );
}
