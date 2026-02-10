import { writable, get } from 'svelte/store';

const STORAGE_KEY = 'input_history';
const isBrowser = typeof window !== 'undefined';

const pad = (v) => String(v ?? 0).padStart(2, '0');

const roundCoord = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num / 0.2) * 0.2;
};

const buildDateLabel = (input) => {
  if (![input?.year, input?.month, input?.day].every((n) => Number.isFinite(Number(n)))) return '';
  const date = `${input.year}-${pad(input.month)}-${pad(input.day)}`;
  if (Number.isFinite(Number(input?.hour)) && Number.isFinite(Number(input?.minute))) {
    return `${date} ${pad(input.hour)}:${pad(input.minute)}`;
  }
  return date;
};

const genderAbbrev = (gender) => (gender === 'male' ? 'M' : gender === 'female' ? 'F' : '');

export const buildHistoryLabel = (input) => {
  const name = String(input?.name || '').trim();
  const gender = genderAbbrev(input?.gender);
  const base = buildDateLabel(input);
  const namePart = name ? `${name}${gender ? ` (${gender})` : ''}` : '';
  const city = String(input?.city || '').trim();
  const parts = namePart ? [namePart, base] : [base];
  if (city) parts.push(city);
  return parts.filter(Boolean).join(' · ');
};

export const buildHistoryKey = (input) => {
  const date = buildDateLabel(input);
  const tz = String(input?.tz_str || '').trim();
  if (!date || !tz) return '';
  const lat = roundCoord(input?.lat);
  const lng = roundCoord(input?.lng);
  const latLabel = Number.isFinite(lat) ? lat.toFixed(1) : '';
  const lngLabel = Number.isFinite(lng) ? lng.toFixed(1) : '';
  return `${date}|${tz}|${latLabel}|${lngLabel}`;
};

const normalizeEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  if (!entry.inputs) return null;
  const key = entry.id || entry.key || buildHistoryKey(entry.inputs);
  if (!key) return null;
  return {
    id: key,
    created_at: entry.created_at || new Date().toISOString(),
    inputs: entry.inputs,
    label: entry.label || buildHistoryLabel(entry.inputs),
  };
};

const readHistory = () => {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry).filter(Boolean);
  } catch (err) {
    console.warn('[history] Failed to read input history', err);
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  }
};

export const subjectHistoryStore = writable(readHistory());

if (isBrowser) {
  subjectHistoryStore.subscribe((value) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (err) {
      console.warn('[history] Failed to persist input history', err);
    }
  });
}

export const addSubjectHistory = (input) => {
  const key = buildHistoryKey(input);
  if (!key) return;
  const entry = {
    id: key,
    created_at: new Date().toISOString(),
    inputs: { ...input },
    label: buildHistoryLabel(input),
  };
  subjectHistoryStore.update((list) => {
    const next = Array.isArray(list) ? [...list] : [];
    const existingIndex = next.findIndex((item) => item?.id === key);
    if (existingIndex !== -1) {
      next.splice(existingIndex, 1);
    }
    next.unshift(entry);
    return next;
  });
};

export const removeSubjectHistory = (id) => {
  if (!id) return;
  subjectHistoryStore.update((list) => (Array.isArray(list) ? list.filter((entry) => entry?.id !== id) : []));
};

export const saveHistoryForState = (state) => {
  if (!state || typeof state !== 'object') return;
  if (state.mode === 'relationship') {
    addSubjectHistory(state?.relationship?.first);
    addSubjectHistory(state?.relationship?.second);
    return;
  }
  if (state.mode === 'natal' || state.mode === 'natal_transit') {
    addSubjectHistory(state?.birth);
  }
};

export const getLatestHistoryLabel = () => {
  const list = get(subjectHistoryStore);
  return list?.[0]?.label || '';
};
