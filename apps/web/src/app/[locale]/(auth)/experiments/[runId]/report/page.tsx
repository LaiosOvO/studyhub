'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import ReportViewer from '@/components/experiments/ReportViewer';

export default function ExperimentReportPage() {
  const t = useTranslations('experiments');
  const params = useParams();
  const runId = params.runId as string;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link
        href={`../`}
        className="mb-4 inline-block text-sm text-blue-600 hover:underline"
      >
        {t('backToExperiments')}
      </Link>

      <h1 className="mb-6 text-2xl font-bold">{t('report')}</h1>

      <ReportViewer runId={runId} />
    </div>
  );
}
