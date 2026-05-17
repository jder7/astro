import { get } from 'svelte/store';
import { cacheStore } from '$lib/state/cacheStore';

const TIMELINE_CACHE_VERSION = 1;
const TIMELINE_CACHE_PAGE = 'advanced';
const TIMELINE_CACHE_FN = 'timeline';
const TIMELINE_CACHE_MAX_ENTRIES = 12;
const NORMALIZED_SPAN_MEMO_MAX_ENTRIES = 12;

const normalizedSpanMemo = new Map();

const pad2 = (value) => String(Math.max(0, Number(value) || 0)).padStart(2, '0');

const finiteNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const roundCoordinate = (value) => {
  const num = finiteNumber(value);
  return num === null ? null : Number(num.toFixed(5));
};

const normalizeActivePoints = (points) => (
  Array.isArray(points)
    ? [...new Set(points.map((point) => String(point || '').trim().toLowerCase()).filter(Boolean))].sort()
    : []
);

const normalizeConfig = (config = {}) => ({
  perspective: config.perspective || 'Topocentric',
  zodiac_type: config.zodiac_type || 'Sidereal',
  sidereal_mode: config.sidereal_mode || null,
  house_system: config.house_system || 'P',
  active_points: normalizeActivePoints(config.active_points),
});

const normalizeBirth = (birth) => {
  if (!birth) return null;
  return {
    year: finiteNumber(birth.year),
    month: finiteNumber(birth.month),
    day: finiteNumber(birth.day),
    hour: finiteNumber(birth.hour),
    minute: finiteNumber(birth.minute),
    lat: roundCoordinate(birth.lat),
    lng: roundCoordinate(birth.lng),
    tz_str: birth.tz_str || null,
  };
};

const normalizeReferenceObservation = (moment, presetKey) => {
  const base = moment || {};
  const date = `${finiteNumber(base.year, 0)}-${pad2(base.month || 1)}-${pad2(base.day || 1)}`;
  const includeTime = presetKey === '1D';
  return {
    date,
    ...(includeTime ? { hour: finiteNumber(base.hour, 12), minute: finiteNumber(base.minute, 0) } : {}),
    lat: roundCoordinate(base.lat),
    lng: roundCoordinate(base.lng),
    tz_str: base.tz_str || null,
  };
};

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      const next = stableValue(value[key]);
      if (next !== undefined) acc[key] = next;
      return acc;
    }, {});
};

const stableStringify = (value) => JSON.stringify(stableValue(value));

const hashString = (value) => {
  let h1 = 0xdeadbeef ^ value.length;
  let h2 = 0x41c6ce57 ^ value.length;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}`;
};

const defaultTimelineCache = () => ({
  version: TIMELINE_CACHE_VERSION,
  entries: {},
  order: [],
});

const getModeTimelineCache = (cache, mode) => {
  const pageEntry = cache?.byPage?.[TIMELINE_CACHE_PAGE] || {};
  const modeEntry = pageEntry.byMode?.[mode] || {};
  const fnEntry = modeEntry[TIMELINE_CACHE_FN];
  if (!fnEntry || fnEntry.version !== TIMELINE_CACHE_VERSION) return defaultTimelineCache();
  return {
    version: TIMELINE_CACHE_VERSION,
    entries: fnEntry.entries && typeof fnEntry.entries === 'object' ? fnEntry.entries : {},
    order: Array.isArray(fnEntry.order) ? fnEntry.order : [],
  };
};

const setModeTimelineCache = (cache, mode, timelineCache) => {
  const pageEntry = cache.byPage?.[TIMELINE_CACHE_PAGE] || {};
  const modeEntry = pageEntry.byMode?.[mode] || {};
  const nextMode = { ...modeEntry, [TIMELINE_CACHE_FN]: timelineCache };
  const nextPage = { ...pageEntry, byMode: { ...(pageEntry.byMode || {}), [mode]: nextMode } };
  return { ...cache, byPage: { ...(cache.byPage || {}), [TIMELINE_CACHE_PAGE]: nextPage } };
};

const pruneEntries = (entries, order, maxEntries = TIMELINE_CACHE_MAX_ENTRIES) => {
  const dedupedOrder = order.filter((key, index, arr) => entries[key] && arr.indexOf(key) === index);
  while (dedupedOrder.length > maxEntries) {
    const staleKey = dedupedOrder.shift();
    delete entries[staleKey];
  }
  return dedupedOrder;
};

export function buildTimelineCacheKey({ state, payload, mode, engine, presetKey }) {
  const effectiveMode = mode === 'natal_transit' ? 'natal_transit' : 'transit';
  const fingerprint = {
    version: TIMELINE_CACHE_VERSION,
    mode: effectiveMode,
    engine: engine === 'kinematic' ? 'kinematic' : 'scan',
    preset: presetKey,
    granularity: payload?.granularity || null,
    reference: normalizeReferenceObservation(state?.transit || payload?.moment, presetKey),
    birth: effectiveMode === 'natal_transit' ? normalizeBirth(payload?.birth) : null,
    config: normalizeConfig(payload?.config),
  };
  const serialized = stableStringify(fingerprint);
  return {
    key: `timeline:v${TIMELINE_CACHE_VERSION}:${hashString(serialized)}`,
    fingerprint,
  };
}

export function getTimelineCacheEntry(mode, key) {
  if (!key) return null;
  let found = null;
  const safeMode = mode || 'transit';
  cacheStore.update((cache) => {
    const timelineCache = getModeTimelineCache(cache, safeMode);
    const existing = timelineCache.entries[key];
    if (!existing?.response) return cache;

    const now = Date.now();
    found = { ...existing, lastAccessedAt: now };
    const entries = { ...timelineCache.entries, [key]: found };
    const order = pruneEntries(entries, [...timelineCache.order.filter((item) => item !== key), key]);
    return setModeTimelineCache(cache, safeMode, { ...timelineCache, entries, order });
  });
  return found;
}

export function setTimelineCacheEntry(mode, key, entry) {
  if (!key || !entry?.response) return;
  const safeMode = mode || 'transit';
  cacheStore.update((cache) => {
    const timelineCache = getModeTimelineCache(cache, safeMode);
    const now = Date.now();
    const entries = {
      ...timelineCache.entries,
      [key]: {
        ...entry,
        key,
        createdAt: entry.createdAt || now,
        lastAccessedAt: now,
      },
    };
    const order = pruneEntries(entries, [...timelineCache.order.filter((item) => item !== key), key]);
    return setModeTimelineCache(cache, safeMode, { ...timelineCache, entries, order });
  });
}

export function getTimelineCacheSnapshot(mode) {
  return getModeTimelineCache(get(cacheStore), mode || 'transit');
}

export function getMemoizedTimelineSpans(memoKey, rawSpans, normalizeFn) {
  if (!memoKey || typeof normalizeFn !== 'function') return [];
  if (normalizedSpanMemo.has(memoKey)) {
    const cached = normalizedSpanMemo.get(memoKey);
    normalizedSpanMemo.delete(memoKey);
    normalizedSpanMemo.set(memoKey, cached);
    return cached;
  }
  const normalized = normalizeFn(rawSpans);
  normalizedSpanMemo.set(memoKey, normalized);
  while (normalizedSpanMemo.size > NORMALIZED_SPAN_MEMO_MAX_ENTRIES) {
    const oldestKey = normalizedSpanMemo.keys().next().value;
    normalizedSpanMemo.delete(oldestKey);
  }
  return normalized;
}

export { TIMELINE_CACHE_MAX_ENTRIES };
