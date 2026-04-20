import { writable } from 'svelte/store';

const isBrowser = typeof window !== 'undefined';

function merge(initialValue, storedValue) {
  if (!storedValue || typeof storedValue !== 'object') return initialValue;
  if (Array.isArray(initialValue)) return Array.isArray(storedValue) ? storedValue : initialValue;
  return { ...initialValue, ...storedValue };
}

export function createPersistedStore(key, initialValue) {
  let startValue = initialValue;
  let storageDisabled = false;
  if (isBrowser) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        startValue = merge(initialValue, parsed);
      }
    } catch (err) {
      console.warn(`[store] Failed to read persisted state for ${key}`, err);
      window.localStorage.removeItem(key);
    }
  }

  const store = writable(startValue);

  if (isBrowser) {
    store.subscribe((value) => {
      if (storageDisabled) return;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        console.warn(`[store] Failed to persist state for ${key}`, err);
        if (err?.name === 'QuotaExceededError') {
          storageDisabled = true;
          try {
            window.localStorage.removeItem(key);
          } catch (cleanupErr) {
            console.warn(`[store] Failed to cleanup storage for ${key}`, cleanupErr);
          }
        }
      }
    });
  }

  return store;
}

export function resetStore(store, valueFactory) {
  const nextValue = typeof valueFactory === 'function' ? valueFactory() : valueFactory;
  store.set(nextValue);
}
