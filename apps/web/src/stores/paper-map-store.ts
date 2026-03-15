import { create } from 'zustand';

interface PaperMapFilters {
  readonly yearRange: readonly [number, number] | null;
  readonly methodTypes: readonly string[];
  readonly qualityThreshold: number;
}

type ActiveView = 'graph' | 'topic' | 'timeline';

interface PaperMapState {
  readonly activeView: ActiveView;
  readonly selectedPaperId: string | null;
  readonly filters: PaperMapFilters;
  readonly readingListPaperIds: readonly string[];
  readonly setActiveView: (view: ActiveView) => void;
  readonly selectPaper: (id: string | null) => void;
  readonly setFilters: (filters: Partial<PaperMapFilters>) => void;
  readonly toggleReadingListPaper: (paperId: string) => void;
}

const DEFAULT_FILTERS: PaperMapFilters = {
  yearRange: null,
  methodTypes: [],
  qualityThreshold: 0,
};

export const usePaperMapStore = create<PaperMapState>()((set) => ({
  activeView: 'graph',
  selectedPaperId: null,
  filters: DEFAULT_FILTERS,
  readingListPaperIds: [],

  setActiveView: (view) => set({ activeView: view }),

  selectPaper: (id) => set({ selectedPaperId: id }),

  setFilters: (partial) =>
    set((state) => ({
      filters: { ...state.filters, ...partial },
    })),

  toggleReadingListPaper: (paperId) =>
    set((state) => {
      const exists = state.readingListPaperIds.includes(paperId);
      return {
        readingListPaperIds: exists
          ? state.readingListPaperIds.filter((id) => id !== paperId)
          : [...state.readingListPaperIds, paperId],
      };
    }),
}));
