import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

interface PageProps {
  readonly params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations('home');

  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24">
      <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
        {t('welcome')}
      </h1>
      <p className="mt-4 max-w-xl text-center text-lg text-gray-600 sm:text-xl">
        {t('description')}
      </p>
    </div>
  );
}
