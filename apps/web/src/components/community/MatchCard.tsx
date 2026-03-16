'use client';

import { useTranslations } from 'next-intl';

import type { MatchResult } from '@/lib/api/community';

import { MatchBreakdown } from './MatchBreakdown';

interface MatchCardProps {
  readonly match: MatchResult;
  readonly onViewProfile: (id: string) => void;
}

export function MatchCard({ match, onViewProfile }: MatchCardProps) {
  const t = useTranslations('community');
  const { profile, overall_score, breakdown, explanation } = match;
  const initial = profile.display_name.charAt(0).toUpperCase();
  const scorePercent = Math.round(overall_score * 100);

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm transition hover:shadow-md">
      {/* Header */}
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-900">
            {profile.display_name}
          </h3>
          {profile.institution && (
            <p className="truncate text-sm text-gray-500">
              {profile.institution}
            </p>
          )}
          {profile.title && (
            <p className="text-xs text-gray-400">{profile.title}</p>
          )}
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-gray-600">{t('matches.score')}</span>
          <span className="font-medium text-green-600">{scorePercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all"
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>

      {/* Expertise tags */}
      {profile.expertise_tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {profile.expertise_tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
            >
              {tag}
            </span>
          ))}
          {profile.expertise_tags.length > 5 && (
            <span className="text-xs text-gray-400">
              +{profile.expertise_tags.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Research directions */}
      {profile.research_directions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {profile.research_directions.map((dir) => (
            <span
              key={dir}
              className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700"
            >
              {dir}
            </span>
          ))}
        </div>
      )}

      {/* Breakdown */}
      <MatchBreakdown breakdown={breakdown} />

      {/* Explanation */}
      {explanation && (
        <p className="mt-3 text-sm italic text-gray-600">
          <span className="font-medium not-italic text-gray-700">
            {t('matches.explanation')}:
          </span>{' '}
          {explanation}
        </p>
      )}

      {/* Action */}
      <button
        type="button"
        onClick={() => onViewProfile(profile.id)}
        className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        {t('profile.title')}
      </button>
    </div>
  );
}
