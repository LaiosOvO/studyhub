'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { usePaperMapStore } from '@/stores/paper-map-store';
import { useReadingLists } from '../hooks/useReadingLists';
import type { Node } from '@xyflow/react';
import type { PaperNodeData } from '@/lib/graph-transforms';

interface ReadingListDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly nodes: readonly Node<PaperNodeData>[];
}

/**
 * Slide-out drawer for managing reading lists.
 * Shows user's lists, allows creating new ones, and
 * adding/removing the currently selected paper.
 */
export function ReadingListDrawer({ isOpen, onClose, nodes }: ReadingListDrawerProps) {
  const t = useTranslations('paperMap');
  const selectedPaperId = usePaperMapStore((state) => state.selectedPaperId);
  const { lists, isLoading, createList, addPaper, removePaper, deleteList } =
    useReadingLists();

  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);

  const handleCreateList = useCallback(async () => {
    if (!newListName.trim()) return;

    try {
      await createList(newListName.trim());
      setNewListName('');
      setIsCreating(false);
    } catch (err) {
      console.error('Failed to create reading list:', err);
    }
  }, [newListName, createList]);

  const handleAddPaper = useCallback(
    async (listId: string) => {
      if (!selectedPaperId) return;

      try {
        await addPaper(listId, selectedPaperId);
      } catch (err) {
        console.error('Failed to add paper:', err);
      }
    },
    [selectedPaperId, addPaper],
  );

  const handleRemovePaper = useCallback(
    async (listId: string, paperId: string) => {
      try {
        await removePaper(listId, paperId);
      } catch (err) {
        console.error('Failed to remove paper:', err);
      }
    },
    [removePaper],
  );

  const handleDeleteList = useCallback(
    async (listId: string) => {
      try {
        await deleteList(listId);
      } catch (err) {
        console.error('Failed to delete reading list:', err);
      }
    },
    [deleteList],
  );

  const toggleExpanded = useCallback((listId: string) => {
    setExpandedListId((prev) => (prev === listId ? null : listId));
  }, []);

  // Find paper title by ID from available nodes
  const getPaperTitle = useCallback(
    (paperId: string): string => {
      const node = nodes.find((n) => n.id === paperId);
      return node?.data.title ?? paperId;
    },
    [nodes],
  );

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-0 z-40 flex h-full w-80 flex-col border-l border-gray-200 bg-white shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          {t('readingList.title')}
        </h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <p className="text-xs text-gray-400">{t('loading')}</p>
        )}

        {/* New list creation */}
        {isCreating ? (
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateList();
                if (e.key === 'Escape') setIsCreating(false);
              }}
              placeholder={t('readingList.newListPlaceholder')}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
              autoFocus
            />
            <button
              onClick={handleCreateList}
              className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
            >
              {t('readingList.create')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="mb-4 w-full rounded border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500"
          >
            + {t('readingList.newList')}
          </button>
        )}

        {/* Reading lists */}
        {lists.map((list) => {
          const isExpanded = expandedListId === list.id;
          const paperCount = list.paper_ids.length;
          const selectedPaperInList = selectedPaperId
            ? list.paper_ids.includes(selectedPaperId)
            : false;

          return (
            <div
              key={list.id}
              className="mb-2 rounded border border-gray-200 bg-gray-50"
            >
              {/* List header */}
              <div className="flex items-center justify-between px-3 py-2">
                <button
                  onClick={() => toggleExpanded(list.id)}
                  className="flex-1 text-left"
                >
                  <span className="text-xs font-medium text-gray-800">
                    {list.name}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {paperCount} {t('readingList.papers')}
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  {/* Add current paper button */}
                  {selectedPaperId && !selectedPaperInList && (
                    <button
                      onClick={() => handleAddPaper(list.id)}
                      className="rounded px-1.5 py-0.5 text-xs text-blue-500 hover:bg-blue-50"
                      title={t('readingList.addToList')}
                    >
                      +
                    </button>
                  )}

                  {/* Delete list button */}
                  <button
                    onClick={() => handleDeleteList(list.id)}
                    className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded paper list */}
              {isExpanded && paperCount > 0 && (
                <div className="border-t border-gray-200 px-3 py-2">
                  {list.paper_ids.map((paperId) => (
                    <div
                      key={paperId}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="flex-1 truncate text-xs text-gray-600">
                        {getPaperTitle(paperId)}
                      </span>
                      <button
                        onClick={() => handleRemovePaper(list.id, paperId)}
                        className="ml-2 text-xs text-red-400 hover:text-red-600"
                        title={t('readingList.removeFromList')}
                      >
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
