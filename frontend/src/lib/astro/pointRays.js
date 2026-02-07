// Primary ray transmitters from docs/education/planets.md (project source).
const POINT_RAYS = {
  mercury: [4],
  venus: [5],
  jupiter: [2],
  saturn: [3],
  uranus: [7],
  neptune: [6],
  vulcan: [1],
  sun: [2],
  mars: [6],
};

const POINT_RAY_ALIASES = {
  asc: 'ascendant',
  mc: 'medium_coeli',
  midheaven: 'medium_coeli',
};

export const normalizePointKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]+/g, '');

export const resolvePointRayKey = (value) => {
  const key = normalizePointKey(value);
  return POINT_RAY_ALIASES[key] || key;
};

export const getPointRays = (value) => {
  const key = resolvePointRayKey(value);
  return POINT_RAYS[key] ? [...POINT_RAYS[key]] : [];
};

export const hasPointRayMapping = (value) => {
  const key = resolvePointRayKey(value);
  return Object.prototype.hasOwnProperty.call(POINT_RAYS, key);
};

export const listMissingPointRays = (keys = []) => {
  const missing = new Set();
  (keys || []).forEach((key) => {
    if (!hasPointRayMapping(key)) {
      const normalized = resolvePointRayKey(key);
      if (normalized) missing.add(normalized);
    }
  });
  return Array.from(missing);
};

export default POINT_RAYS;
