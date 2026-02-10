import { get } from 'svelte/store';
import { inputStore, setMode, updateBirth, updateRelationship, updateTransit } from '$lib/state/inputStore';

const isBrowser = typeof window !== 'undefined';
const VALID_MODES = new Set(['natal', 'transit', 'natal_transit', 'relationship']);

const pad = (v) => String(v ?? 0).padStart(2, '0');

const formatDateParam = (input) => {
  if (!input) return '';
  const { year, month, day } = input;
  if (![year, month, day].every((n) => Number.isFinite(Number(n)))) return '';
  const date = `${year}-${pad(month)}-${pad(day)}`;
  if (Number.isFinite(Number(input?.hour)) && Number.isFinite(Number(input?.minute))) {
    return `${date}T${pad(input.hour)}:${pad(input.minute)}`;
  }
  return date;
};

const parseDateParam = (value) => {
  if (!value) return null;
  const cleaned = String(value).trim();
  if (!cleaned) return null;
  const [datePart, timePart] = cleaned.split(/[T ]/);
  if (!datePart) return null;
  const [year, month, day] = datePart.split('-').map((n) => parseInt(n, 10));
  if (![year, month, day].every((n) => Number.isFinite(n))) return null;
  const patch = { year, month, day };
  if (timePart) {
    const match = timePart.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      if (Number.isFinite(hour) && Number.isFinite(minute)) {
        patch.hour = hour;
        patch.minute = minute;
      }
    }
  }
  return patch;
};

const parseGender = (value) => {
  if (!value) return '';
  const normalized = String(value).trim().toLowerCase();
  if (normalized.startsWith('m')) return 'male';
  if (normalized.startsWith('f')) return 'female';
  return '';
};

const parseCoord = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const buildSubjectParams = (params, subject, prefix, options = {}) => {
  if (!subject) return;
  const date = formatDateParam(subject);
  if (date) params.set(`${prefix}_date`, date);
  if (subject?.tz_str) params.set(`${prefix}_tz`, subject.tz_str);
  if (Number.isFinite(Number(subject?.lat))) params.set(`${prefix}_lat`, Number(subject.lat).toString());
  if (Number.isFinite(Number(subject?.lng))) params.set(`${prefix}_lng`, Number(subject.lng).toString());
  if (subject?.city) params.set(`${prefix}_city`, subject.city);
  if (subject?.name && options.includeName !== false) params.set(`${prefix}_name`, subject.name);
  if (subject?.gender && options.includeGender !== false) params.set(`${prefix}_gender`, subject.gender);
};

const parseSubjectParams = (params, prefix, options = {}) => {
  const patch = {};
  const datePatch = parseDateParam(params.get(`${prefix}_date`));
  if (datePatch) Object.assign(patch, datePatch);
  const tz = params.get(`${prefix}_tz`);
  if (tz) patch.tz_str = tz;
  const name = params.get(`${prefix}_name`);
  if (name) patch.name = name;
  if (options.includeGender !== false) {
    const gender = parseGender(params.get(`${prefix}_gender`));
    if (gender) patch.gender = gender;
  }
  const lat = parseCoord(params.get(`${prefix}_lat`));
  const lng = parseCoord(params.get(`${prefix}_lng`));
  const city = params.get(`${prefix}_city`);
  const nation = params.get(`${prefix}_nation`);
  const hasLocation = lat !== null || lng !== null || Boolean(city) || Boolean(nation);
  if (hasLocation) {
    if (lat !== null) patch.lat = lat;
    if (lng !== null) patch.lng = lng;
    if (city) patch.city = city;
    if (nation) patch.nation = nation;
  }
  return Object.keys(patch).length ? patch : null;
};

export const buildShareParams = (state) => {
  const params = new URLSearchParams();
  if (!state?.mode) return params;
  params.set('mode', state.mode);

  if (state.mode === 'natal' || state.mode === 'natal_transit') {
    buildSubjectParams(params, state.birth, 's1');
  }
  if (state.mode === 'transit' || state.mode === 'natal_transit') {
    buildSubjectParams(params, state.transit, 't', { includeGender: false });
  }
  if (state.mode === 'relationship') {
    buildSubjectParams(params, state.relationship?.first, 's1');
    buildSubjectParams(params, state.relationship?.second, 's2');
  }

  return params;
};

export const buildShareUrl = (state) => {
  if (!isBrowser) return '';
  const url = new URL(window.location.href);
  const params = buildShareParams(state);
  url.search = params.toString();
  return url.toString();
};

export const hasShareParams = () => {
  if (!isBrowser) return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.has('mode') ||
    params.has('t_date') ||
    params.has('s1_date') ||
    params.has('s2_date') ||
    params.has('t_tz') ||
    params.has('s1_tz') ||
    params.has('s2_tz')
  );
};

export const applyShareParamsFromUrl = () => {
  if (!isBrowser) return { applied: false, mode: '' };
  const params = new URLSearchParams(window.location.search);
  if (!params || !params.keys().next().value) return { applied: false, mode: '' };

  const modeParam = params.get('mode');
  const mode = VALID_MODES.has(modeParam) ? modeParam : '';
  if (mode) {
    setMode(mode);
  }

  const activeMode = mode || get(inputStore).mode;
  let applied = false;

  const applyPatch = (patchFn, patch) => {
    if (!patch || !Object.keys(patch).length) return;
    patchFn(patch);
    applied = true;
  };

  if (activeMode === 'natal') {
    applyPatch(updateBirth, parseSubjectParams(params, 's1'));
  } else if (activeMode === 'transit') {
    applyPatch(updateTransit, parseSubjectParams(params, 't', { includeGender: false }));
  } else if (activeMode === 'natal_transit') {
    applyPatch(updateBirth, parseSubjectParams(params, 's1'));
    applyPatch(updateTransit, parseSubjectParams(params, 't', { includeGender: false }));
  } else if (activeMode === 'relationship') {
    applyPatch((patch) => updateRelationship('first', patch), parseSubjectParams(params, 's1'));
    applyPatch((patch) => updateRelationship('second', patch), parseSubjectParams(params, 's2'));
  }

  return { applied, mode: activeMode };
};

export const clearShareParams = () => {
  if (!isBrowser) return;
  const url = new URL(window.location.href);
  if (!url.search) return;
  url.search = '';
  window.history.replaceState({}, '', url.toString());
};
