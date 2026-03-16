'use client';

import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { ResearcherProfilePublic } from '@/lib/api/community';
import { fetchProfile } from '@/lib/api/community';

export default function PublicProfilePage() {
  const t = useTranslations('community');
  const params = useParams();
  const router = useRouter();
  const profileId = params.profileId as string;

  const [profile, setProfile] = useState<ResearcherProfilePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetchProfile(profileId);
        if (response.success) {
          setProfile(response.data);
        } else {
          setError(response.error);
        }
      } catch {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profileId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-32 rounded bg-gray-100" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">{error ?? 'Profile not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {profile.display_name}
        </h1>
        {profile.institution && (
          <p className="text-lg text-gray-600">{profile.institution}</p>
        )}
        {profile.title && (
          <p className="text-sm text-gray-500">{profile.title}</p>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {profile.h_index ?? '-'}
          </p>
          <p className="text-xs text-gray-500">{t('profile.hIndex')}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {profile.total_citations?.toLocaleString() ?? '-'}
          </p>
          <p className="text-xs text-gray-500">{t('profile.citations')}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">
            {profile.publication_count ?? '-'}
          </p>
          <p className="text-xs text-gray-500">{t('profile.publications')}</p>
        </div>
      </div>

      {/* Research directions */}
      {profile.research_directions.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            {t('profile.directions')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.research_directions.map((dir) => (
              <span
                key={dir}
                className="rounded-full bg-purple-50 px-3 py-1 text-sm text-purple-700"
              >
                {dir}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expertise tags */}
      {profile.expertise_tags.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            {t('profile.expertise')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.expertise_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Publications */}
      {profile.publications.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            {t('profile.publications')}
          </h2>
          <div className="space-y-2">
            {profile.publications.map((pub, idx) => (
              <div
                key={`pub-${idx}`}
                className="rounded border bg-gray-50 p-3"
              >
                <p className="text-sm font-medium text-gray-800">
                  {(pub as Record<string, unknown>).title as string}
                </p>
                <div className="mt-1 flex gap-4 text-xs text-gray-500">
                  {(pub as Record<string, unknown>).year && (
                    <span>{String((pub as Record<string, unknown>).year)}</span>
                  )}
                  {(pub as Record<string, unknown>).cited_by_count !== undefined && (
                    <span>
                      {t('profile.citations')}:{' '}
                      {String((pub as Record<string, unknown>).cited_by_count)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Co-authors */}
      {profile.co_authors.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            {t('profile.coAuthors')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.co_authors.map((name) => (
              <span
                key={name}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600"
              >
                {String(name)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Send message button */}
      <button
        type="button"
        onClick={() =>
          router.push(`/community/messages?to=${profile.id}`)
        }
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        {t('profile.sendMessage')}
      </button>
    </div>
  );
}
