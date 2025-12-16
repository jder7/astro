import { createPersistedStore, resetStore } from './persistence';

const defaultModeCache = () => ({
  svg: '',
  summary: null,
  report: null,
  response: null,
  birthParts: null,
  transitParts: null,
});
export const createDefaultCache = () => ({ byMode: {} });

export const cacheStore = createPersistedStore('astroApiState', createDefaultCache());

export function setCacheForMode(mode, data) {
  cacheStore.update((cache) => {
    const next = { ...(cache.byMode?.[mode] || defaultModeCache()), ...data };
    return { ...cache, byMode: { ...(cache.byMode || {}), [mode]: next } };
  });
}

export function resetCache() {
  resetStore(cacheStore, createDefaultCache);
}
