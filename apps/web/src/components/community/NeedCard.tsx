'use client';

import { useTranslations } from 'next-intl';

import type { ResearchNeed } from '@/lib/api/community';

interface NeedCardProps {
  readonly need: ResearchNeed & { readonly match_score?: number };
  readonly onContact: (userId: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
  filled: 'bg-blue-100 text-blue-700',
};

export function NeedCard({ need, onContact }: NeedCardProps) {
  const t = useTranslations('community');
  const scorePercent = need.match_score
    ? Math.round(need.match_score * 100)
    : null;

  const statusStyle = STATUS_STYLES[need.status] ?? STATUS_STYLES.open;
  const statusLabel =
    need.status === 'open'
      ? t('needs.card.open')
      : need.status === 'closed'
        ? t('needs.card.closed')
        : t('needs.card.filled');

  const createdDate = new Date(need.created_at).toLocaleDateString();

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">{need.title}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}>
          {statusLabel}
        </span>
      </div>

      {/* Description */}
      <p className="mb-3 text-sm text-gray-600">
        {need.description.length > 200
          ? `${need.description.slice(0, 200)}...`
          : need.description}
      </p>

      {/* Required skills */}
      {need.required_skills.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {need.required_skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Research direction */}
      {need.research_direction && (
        <div className="mb-2">
          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
            {need.research_direction}
          </span>
        </div>
      )}

      {/* Tags */}
      {need.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {need.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Match score */}
      {scorePercent !== null && scorePercent > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-gray-500">{t('needs.card.matchScore')}</span>
            <span className="font-medium text-green-600">{scorePercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{createdDate}</span>
        <button
          type="button"
          onClick={() => onContact(need.user_id)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
        >
          {t('needs.card.contact')}
        </button>
      </div>
    </div>
  );
}
