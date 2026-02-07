import { createPersistedStore, resetStore } from './persistence';

const defaultFnCache = () => ({
  svg: '',
  summary: null,
  report: null,
  response: null,
  timeRangeSweeps: null,
});

export const createDefaultCache = () => ({ byPage: {} });

export const cacheStore = createPersistedStore('astroApiStateV2', createDefaultCache());

export function setCacheEntry(page, mode, fn, data) {
  cacheStore.update((cache) => {
    const safePage = page || 'home';
    const safeMode = mode || 'natal';
    const safeFn = fn || 'chart';

    const pageEntry = cache.byPage?.[safePage] || {};
    const modeEntry = pageEntry.byMode?.[safeMode] || {};
    const fnEntry = modeEntry[safeFn] || defaultFnCache();

    const nextFn = { ...fnEntry, ...data };
    const nextMode = { ...modeEntry, [safeFn]: nextFn };
    const nextPage = { ...pageEntry, byMode: { ...(pageEntry.byMode || {}), [safeMode]: nextMode } };

    return { ...cache, byPage: { ...(cache.byPage || {}), [safePage]: nextPage } };
  });
}

export function resetCache() {
  resetStore(cacheStore, createDefaultCache);
}
