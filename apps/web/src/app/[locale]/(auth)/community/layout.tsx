'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { NotificationBadge } from '@/components/community/NotificationBadge';

interface CommunityLayoutProps {
  readonly children: ReactNode;
}

const TABS = [
  { key: 'matches', href: 'community/matches' },
  { key: 'needs', href: 'community/needs' },
  { key: 'messages', href: 'community/messages' },
] as const;

export default function CommunityLayout({ children }: CommunityLayoutProps) {
  const t = useTranslations('community');
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Tab Navigation */}
      <nav className="mb-6 flex gap-1 border-b">
        {TABS.map(({ key, href }) => {
          const isActive = pathname.includes(href.split('/').pop() ?? '');

          return (
            <Link
              key={key}
              href={`/${href}`}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t(`tabs.${key}`)}
              {key === 'messages' && <NotificationBadge />}
            </Link>
          );
        })}
      </nav>

      {/* Page Content */}
      {children}
    </div>
  );
}
