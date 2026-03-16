'use client';

import { useTranslations } from 'next-intl';

import type { MatchSignalBreakdown } from '@/lib/api/community';

interface MatchBreakdownProps {
  readonly breakdown: MatchSignalBreakdown;
}

const SIGNAL_CONFIG = [
  { key: 'complementarity' as const, color: 'bg-blue-500', i18nKey: 'complementarity' },
  { key: 'co_citation' as const, color: 'bg-purple-500', i18nKey: 'coCitation' },
  { key: 'adjacency' as const, color: 'bg-green-500', i18nKey: 'adjacency' },
  { key: 'institutional' as const, color: 'bg-amber-500', i18nKey: 'institutional' },
] as const;

export function MatchBreakdown({ breakdown }: MatchBreakdownProps) {
  const t = useTranslations('community');

  return (
    <div className="space-y-1.5">
      {SIGNAL_CONFIG.map(({ key, color, i18nKey }) => {
        const value = breakdown[key];
        const percent = Math.round(value * 100);

        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-gray-500">
              {t(`breakdown.${i18nKey}`)}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${color} transition-all`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="w-8 text-right text-gray-400">{percent}%</span>
          </div>
        );
      })}
    </div>
  );
}
