import { createPersistedStore, resetStore } from './persistence';

const defaultBirth = () => ({
  name: 'Subject',
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

export const inputStore = createPersistedStore('astroInputState', createDefaultInputs());

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
