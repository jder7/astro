import { createPersistedStore, resetStore } from './persistence';

const defaultFnCache = () => ({
  svg: '',
  summary: null,
  report: null,
  response: null,
  timeRangeSweeps: null,
});

export const createDefaultCache = () => ({ byPage: {} });

const CACHE_STORAGE_KEY = 'astroApiState';
const LEGACY_CACHE_KEYS = ['astroApiStateV2'];
const LEGACY_UNUSED_KEYS = ['astroApiStateAdvanced'];

function migrateCacheStorage() {
  if (typeof window === 'undefined') return;
  try {
    const current = window.localStorage.getItem(CACHE_STORAGE_KEY);
    if (!current) {
      for (const key of LEGACY_CACHE_KEYS) {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        window.localStorage.setItem(CACHE_STORAGE_KEY, raw);
        break;
      }
    }
    for (const key of LEGACY_CACHE_KEYS) {
      if (key !== CACHE_STORAGE_KEY) window.localStorage.removeItem(key);
    }
    for (const key of LEGACY_UNUSED_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch (err) {
    // ignore storage migration errors
  }
}

migrateCacheStorage();

export const cacheStore = createPersistedStore(CACHE_STORAGE_KEY, createDefaultCache());

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
