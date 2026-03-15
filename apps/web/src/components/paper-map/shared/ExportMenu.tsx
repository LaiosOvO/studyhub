'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toPng } from 'html-to-image';
import type { Node, Edge } from '@xyflow/react';
import type { PaperNodeData } from '@/lib/graph-transforms';

interface ExportMenuProps {
  readonly nodes: readonly Node<PaperNodeData>[];
  readonly edges: readonly Edge[];
  readonly graphContainerRef: React.RefObject<HTMLDivElement | null>;
}

/** Format current date as YYYY-MM-DD for filenames. */
function formatDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Trigger a file download from a Blob. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Escape a CSV field value (wrap in quotes if it contains commas or quotes). */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export dropdown menu with JSON, CSV, and PNG export options.
 * All export functions are pure: read data, produce output.
 */
export function ExportMenu({ nodes, edges, graphContainerRef }: ExportMenuProps) {
  const t = useTranslations('paperMap');
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleExportJson = useCallback(() => {
    const date = formatDate();
    const data = {
      exportedAt: new Date().toISOString(),
      nodes: nodes.map((n) => ({
        paper_id: n.id,
        title: n.data.title,
        year: n.data.year,
        citation_count: n.data.citationCount,
        quality_score: n.data.qualityScore,
        cluster: n.data.clusterId,
        methods: [...n.data.methods],
      })),
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    downloadBlob(blob, `research-graph-${date}.json`);
    setIsOpen(false);
  }, [nodes, edges]);

  const handleExportCsv = useCallback(() => {
    const date = formatDate();
    const headers = ['paper_id', 'title', 'year', 'citation_count', 'quality_score', 'cluster'];
    const rows = nodes.map((n) =>
      [
        n.id,
        escapeCsvField(n.data.title),
        String(n.data.year),
        String(n.data.citationCount),
        String(n.data.qualityScore),
        n.data.clusterId,
      ].join(','),
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `research-papers-${date}.csv`);
    setIsOpen(false);
  }, [nodes]);

  const handleExportPng = useCallback(async () => {
    const container = graphContainerRef.current;
    if (!container) return;

    try {
      const dataUrl = await toPng(container, { backgroundColor: '#ffffff' });
      const date = formatDate();

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `research-graph-${date}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('PNG export failed:', err);
    }

    setIsOpen(false);
  }, [graphContainerRef]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        {t('export.label')}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded border border-gray-200 bg-white py-1 shadow-lg">
          <button
            onClick={handleExportJson}
            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
          >
            {t('export.json')}
          </button>
          <button
            onClick={handleExportCsv}
            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
          >
            {t('export.csv')}
          </button>
          <button
            onClick={handleExportPng}
            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
          >
            {t('export.png')}
          </button>
        </div>
      )}
    </div>
  );
}
