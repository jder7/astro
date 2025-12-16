import { createPersistedStore, resetStore } from './persistence';

export const createDefaultRange = () => ({
  end: { year: 2025, month: 1, day: 2, hour: 12, minute: 0 },
  granularity: 'HOUR',
  include_aspects: true,
});

export const rangeStore = createPersistedStore('astroRange', createDefaultRange());

export function updateRange(patch) {
  rangeStore.update((state) => ({
    ...state,
    ...patch,
    end: patch?.end ? { ...state.end, ...patch.end } : state.end,
  }));
}

export function resetRange() {
  resetStore(rangeStore, createDefaultRange);
}
