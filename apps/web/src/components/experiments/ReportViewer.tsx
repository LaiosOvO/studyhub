'use client';

import { useCallback, useEffect, useState } from 'react';

import Markdown from 'react-markdown';
import { useTranslations } from 'next-intl';

import type { ExperimentReportResponse } from '@/lib/api/experiments';
import {
  downloadExperimentReportPdf,
  fetchExperimentReport,
  generateExperimentReport,
} from '@/lib/api/experiments';

interface ReportViewerProps {
  readonly runId: string;
}

export default function ReportViewer({ runId }: ReportViewerProps) {
  const t = useTranslations('experiments');

  const [report, setReport] = useState<ExperimentReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExperimentReport(runId, 'markdown');
      setReport(data);
    } catch {
      // 404 means no report yet — not an error
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await generateExperimentReport(runId);
      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate report',
      );
    } finally {
      setGenerating(false);
    }
  }, [runId]);

  const handleDownloadPdf = useCallback(async () => {
    try {
      const blob = await downloadExperimentReportPdf(runId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `experiment_${runId.slice(0, 8)}_report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to download PDF',
      );
    }
  }, [runId]);

  if (loading) {
    return (
      <p className="py-8 text-center text-gray-500">{t('loading')}</p>
    );
  }

  if (!report || !report.has_report) {
    return (
      <div className="py-8 text-center">
        <p className="mb-4 text-gray-400">{t('reportNotGenerated')}</p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? t('generating') : t('generateReport')}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {/* Action Buttons */}
      <div className="mb-4 flex gap-3">
        {report.pdf_url && (
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            {t('downloadPdf')}
          </button>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {generating ? t('generating') : t('regenerateReport')}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* Markdown Content */}
      {report.markdown && (
        <div className="prose prose-sm max-w-none rounded-lg border bg-white p-6 shadow-sm">
          <Markdown>{report.markdown}</Markdown>
        </div>
      )}
    </div>
  );
}
