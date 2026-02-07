import { createPersistedStore, resetStore } from './persistence';

export const createDefaultConfig = () => ({
  perspective: 'Topocentric',
  zodiac_type: 'Sidereal',
  sidereal_mode: 'KRISHNAMURTI',
  house_system: 'P',
  theme: 'dark',
  active_points: ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'ascendant'],
  asc_moon_sun_range_enabled: false,
  include_aspects: false,
});

export const configStore = createPersistedStore('astroConfig', createDefaultConfig());

export function updateConfig(patch) {
  configStore.update((cfg) => {
    const next = { ...cfg, ...patch };
    if (patch?.active_points) {
      next.active_points = Array.from(new Set(patch.active_points)).filter(Boolean);
    }
    return next;
  });
}

export function resetConfig() {
  resetStore(configStore, createDefaultConfig);
}
