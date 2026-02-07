import { createPersistedStore, resetStore } from './persistence';

export const createDefaultRange = () => ({
  start: { year: 2025, month: 1, day: 1, hour: 12, minute: 0 },
  end: { year: 2025, month: 1, day: 2, hour: 12, minute: 0 },
  granularity: 'hour',
  include_aspects: true,
});

export const rangeStore = createPersistedStore('astroRange', createDefaultRange());

export function updateRange(patch) {
  rangeStore.update((state) => ({
    ...state,
    ...patch,
    start: patch?.start ? { ...state.start, ...patch.start } : state.start,
    end: patch?.end ? { ...state.end, ...patch.end } : state.end,
  }));
}

export function resetRange() {
  resetStore(rangeStore, createDefaultRange);
}
