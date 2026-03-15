import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { MapView } from '@/components/paper-map/MapView';

interface MapPageProps {
  readonly params: Promise<{
    readonly locale: string;
    readonly taskId: string;
  }>;
}

export default async function MapPage({ params }: MapPageProps) {
  const { locale, taskId } = await params;
  setRequestLocale(locale);

  return <MapPageContent taskId={taskId} />;
}

function MapPageContent({ taskId }: { readonly taskId: string }) {
  const t = useTranslations('paperMap');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-gray-900">{t('pageTitle')}</h1>
      <MapView taskId={taskId} />
    </div>
  );
}
