'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { usePaperMapStore } from '@/stores/paper-map-store';
import type { PaperNodeData } from '@/lib/graph-transforms';
import type { Node } from '@xyflow/react';

interface FilterBarProps {
  readonly nodes: readonly Node<PaperNodeData>[];
}

/**
 * Horizontal filter bar with year range, quality threshold slider,
 * and method type multi-select. Reads/writes filters via Zustand store.
 */
export function FilterBar({ nodes }: FilterBarProps) {
  const t = useTranslations('paperMap');
  const filters = usePaperMapStore((state) => state.filters);
  const setFilters = usePaperMapStore((state) => state.setFilters);

  const currentYear = new Date().getFullYear();

  // Derive unique methods from all nodes
  const availableMethods = useMemo(() => {
    const methodSet = new Set<string>();
    for (const node of nodes) {
      for (const method of node.data.methods) {
        methodSet.add(method);
      }
    }
    return Array.from(methodSet).sort();
  }, [nodes]);

  const handleYearFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const from = parseInt(e.target.value, 10);
      if (isNaN(from)) return;
      const currentRange = filters.yearRange;
      const to = currentRange ? currentRange[1] : currentYear;
      setFilters({ yearRange: [from, to] });
    },
    [filters.yearRange, setFilters, currentYear],
  );

  const handleYearToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const to = parseInt(e.target.value, 10);
      if (isNaN(to)) return;
      const currentRange = filters.yearRange;
      const from = currentRange ? currentRange[0] : 1900;
      setFilters({ yearRange: [from, to] });
    },
    [filters.yearRange, setFilters],
  );

  const handleClearYearRange = useCallback(() => {
    setFilters({ yearRange: null });
  }, [setFilters]);

  const handleQualityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters({ qualityThreshold: parseFloat(e.target.value) });
    },
    [setFilters],
  );

  const handleMethodToggle = useCallback(
    (method: string) => {
      const current = filters.methodTypes;
      const updated = current.includes(method)
        ? current.filter((m) => m !== method)
        : [...current, method];
      setFilters({ methodTypes: updated });
    },
    [filters.methodTypes, setFilters],
  );

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-gray-200 bg-white px-4 py-2">
      {/* Year range */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">
          {t('filter.yearRange')}
        </span>
        <input
          type="number"
          min={1900}
          max={currentYear}
          value={filters.yearRange ? filters.yearRange[0] : ''}
          onChange={handleYearFromChange}
          placeholder="1900"
          className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <span className="text-xs text-gray-400">-</span>
        <input
          type="number"
          min={1900}
          max={currentYear}
          value={filters.yearRange ? filters.yearRange[1] : ''}
          onChange={handleYearToChange}
          placeholder={String(currentYear)}
          className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
        />
        {filters.yearRange && (
          <button
            onClick={handleClearYearRange}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            {t('filter.clear')}
          </button>
        )}
      </div>

      {/* Quality threshold slider */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">
          {t('filter.qualityThreshold')}
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={filters.qualityThreshold}
          onChange={handleQualityChange}
          className="w-24"
        />
        <span className="text-xs text-gray-600">
          {(filters.qualityThreshold * 100).toFixed(0)}%
        </span>
      </div>

      {/* Method type multi-select */}
      {availableMethods.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">
            {t('filter.methodType')}
          </span>
          <div className="flex flex-wrap gap-1">
            {availableMethods.map((method) => {
              const isSelected = filters.methodTypes.includes(method);
              return (
                <button
                  key={method}
                  onClick={() => handleMethodToggle(method)}
                  className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {method}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
