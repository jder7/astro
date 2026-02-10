import { get } from 'svelte/store';
import { createPersistedStore, resetStore } from './persistence';

const STORAGE_KEY = 'navigationState';
const LEGACY_KEY = 'astroInputState';
const isBrowser = typeof window !== 'undefined';

const defaultBirth = () => ({
  name: 'Subject',
  gender: '',
  year: 1990,
  month: 1,
  day: 1,
  hour: 12,
  minute: 0,
  lat: 52.3702,
  lng: 4.8952,
  tz_str: 'Europe/Amsterdam',
  city: 'Amsterdam',
  nation: 'NL',
});

const defaultTransit = () => ({
  year: 2025,
  month: 1,
  day: 1,
  hour: 12,
  minute: 0,
  lat: 52.3702,
  lng: 4.8952,
  tz_str: 'Europe/Amsterdam',
  city: 'Amsterdam',
  nation: 'NL',
});

const defaultRelationship = () => ({
  first: {
    name: 'Partner A',
    gender: '',
    year: 1990,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    lat: 52.3702,
    lng: 4.8952,
    tz_str: 'Europe/Amsterdam',
    city: 'Amsterdam',
    nation: 'NL',
  },
  second: {
    name: 'Partner B',
    gender: '',
    year: 1992,
    month: 2,
    day: 2,
    hour: 14,
    minute: 0,
    lat: 40.7128,
    lng: -74.006,
    tz_str: 'America/New_York',
    city: 'New York',
    nation: 'US',
  },
});

export const createDefaultInputs = () => ({
  mode: 'natal',
  birth: defaultBirth(),
  transit: defaultTransit(),
  relationship: defaultRelationship(),
});

const mergeSubject = (base, incoming) => ({ ...base, ...(incoming || {}) });

const mergeInputs = (incoming) => {
  const base = createDefaultInputs();
  const next = { ...(incoming || {}) };
  return {
    ...base,
    ...next,
    birth: mergeSubject(base.birth, next.birth),
    transit: mergeSubject(base.transit, next.transit),
    relationship: {
      first: mergeSubject(base.relationship.first, next?.relationship?.first),
      second: mergeSubject(base.relationship.second, next?.relationship?.second),
    },
  };
};

const normalizeNavigationState = (raw) => {
  const base = { current: createDefaultInputs(), stack: [], cursor: -1 };
  if (!raw || typeof raw !== 'object') return base;
  const current = mergeInputs(raw.current || raw);
  const stack = Array.isArray(raw.stack) ? raw.stack.map((entry) => mergeInputs(entry)) : [];
  const cursor = Number.isFinite(raw.cursor) ? raw.cursor : stack.length - 1;
  return { ...base, current, stack, cursor };
};

const migrateLegacyState = () => {
  if (!isBrowser) return;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      const normalized = normalizeNavigationState(parsed);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      if (window.localStorage.getItem(LEGACY_KEY)) {
        window.localStorage.removeItem(LEGACY_KEY);
      }
      return;
    }
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const parsed = JSON.parse(legacy);
    const normalized = normalizeNavigationState(parsed);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.localStorage.removeItem(LEGACY_KEY);
  } catch (err) {
    console.warn('[store] Failed to migrate input state', err);
  }
};

migrateLegacyState();

export const navigationStore = createPersistedStore(STORAGE_KEY, normalizeNavigationState(null));

export const inputStore = {
  subscribe: (run) => navigationStore.subscribe((state) => run(state.current)),
  set: (value) => navigationStore.update((state) => ({ ...state, current: mergeInputs(value) })),
  update: (updater) =>
    navigationStore.update((state) => ({ ...state, current: mergeInputs(updater(state.current)) })),
};

const buildTransitKey = (state) => {
  if (!state?.transit) return '';
  const t = state.transit;
  return [
    state.mode || '',
    t.year ?? '',
    t.month ?? '',
    t.day ?? '',
    t.hour ?? '',
    t.minute ?? '',
    t.tz_str ?? '',
    Number.isFinite(Number(t.lat)) ? Number(t.lat).toFixed(4) : '',
    Number.isFinite(Number(t.lng)) ? Number(t.lng).toFixed(4) : '',
    t.city ?? '',
  ].join('|');
};

const pushNavigationSnapshot = (state, nextCurrent) => {
  const base = state?.current ? mergeInputs(state.current) : createDefaultInputs();
  const stack = Array.isArray(state?.stack) ? [...state.stack] : [];
  let cursor = Number.isFinite(state?.cursor) ? state.cursor : stack.length - 1;

  if (!stack.length) {
    stack.push(base);
    cursor = 0;
  }

  if (cursor < stack.length - 1) {
    stack.splice(cursor + 1);
  }

  const nextKey = buildTransitKey(nextCurrent);
  const lastKey = buildTransitKey(stack[stack.length - 1]);
  if (nextKey && nextKey === lastKey) {
    return { ...state, current: nextCurrent, stack, cursor: stack.length - 1 };
  }

  stack.push(nextCurrent);
  cursor = stack.length - 1;
  return { ...state, current: nextCurrent, stack, cursor };
};

export const getNavigationState = () => get(navigationStore);

export const updateNavigationState = (updater) => {
  navigationStore.update((state) => normalizeNavigationState(updater(state)));
};

export const updateTransitWithNavigation = (patch, options = {}) => {
  const shouldPush = options.push !== false;
  navigationStore.update((state) => {
    const base = state?.current ? mergeInputs(state.current) : createDefaultInputs();
    const nextCurrent = { ...base, transit: { ...base.transit, ...patch } };
    if (!shouldPush) {
      return { ...state, current: nextCurrent };
    }
    return pushNavigationSnapshot(state, nextCurrent);
  });
};

export const navigateTransitHistory = (direction) => {
  navigationStore.update((state) => {
    const stack = Array.isArray(state?.stack) ? state.stack : [];
    if (!stack.length) return state;
    const cursor = Number.isFinite(state?.cursor) ? state.cursor : stack.length - 1;
    const nextCursor = cursor + direction;
    if (nextCursor < 0 || nextCursor >= stack.length) return state;
    const nextCurrent = mergeInputs(stack[nextCursor]);
    return { ...state, current: nextCurrent, cursor: nextCursor };
  });
};

export function setMode(mode) {
  inputStore.update((state) => ({ ...state, mode }));
}

export function updateBirth(patch) {
  inputStore.update((state) => ({ ...state, birth: { ...state.birth, ...patch } }));
}

export function updateTransit(patch) {
  inputStore.update((state) => ({ ...state, transit: { ...state.transit, ...patch } }));
}

export function updateRelationship(which, patch) {
  inputStore.update((state) => {
    const next = { ...state.relationship[which], ...patch };
    return { ...state, relationship: { ...state.relationship, [which]: next } };
  });
}

export function resetInputs() {
  resetStore(inputStore, createDefaultInputs);
}
