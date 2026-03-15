'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { type Locale } from '@/i18n/config';

const localeLabels: Record<Locale, string> = {
  'zh-CN': '中文',
  en: 'English',
};

export function LanguageToggle() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const nextLocale: Locale = locale === 'zh-CN' ? 'en' : 'zh-CN';

  function handleToggle() {
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <button
      onClick={handleToggle}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
      aria-label={`Switch to ${localeLabels[nextLocale]}`}
    >
      {localeLabels[nextLocale]}
    </button>
  );
}
