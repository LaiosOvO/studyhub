import { create } from 'zustand';

interface ExperimentState {
  readonly selectedRunId: string | null;
  readonly statusFilter: string;
  readonly selectRun: (id: string | null) => void;
  readonly setStatusFilter: (filter: string) => void;
}

export const useExperimentStore = create<ExperimentState>()((set) => ({
  selectedRunId: null,
  statusFilter: 'all',

  selectRun: (id) => set({ selectedRunId: id }),

  setStatusFilter: (filter) => set({ statusFilter: filter }),
}));
