const RANGE_KEYS = {
  asc: ['ascendantDayRange', 'ascendant_day_range'],
  moon: ['moonMonthRange', 'moon_month_range'],
  sun: ['sunYearRange', 'sun_year_range'],
};

const RANGE_SOURCES = [
  (payload) => payload,
  (payload) => payload?.snapshot,
  (payload) => payload?.subject,
  (payload) => payload?.snapshot?.subject,
];

const SUBJECT_SOURCES = [
  (payload) => payload?.snapshot?.subject,
  (payload) => payload?.subject,
  (payload) => payload?.snapshot,
  (payload) => payload?.data,
  (payload) => payload,
];

const NATAL_SOURCES = [
  (payload) => payload?.snapshot?.natal_subject,
  (payload) => payload?.natal_subject,
  (payload) => payload?.second_subject,
];

const toCamel = (value) => {
  if (typeof value !== 'string') return value;
  return value.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
};

const pickList = (payload, keys = []) => {
  for (const getSource of RANGE_SOURCES) {
    const source = getSource(payload);
    if (!source) continue;
    for (const key of keys) {
      if (Array.isArray(source[key])) return source[key];
      const alt = toCamel(key);
      if (alt !== key && Array.isArray(source[alt])) return source[alt];
    }
  }
  return [];
};

export function extractRanges(payload) {
  return {
    asc: pickList(payload, RANGE_KEYS.asc),
    moon: pickList(payload, RANGE_KEYS.moon),
    sun: pickList(payload, RANGE_KEYS.sun),
  };
}

export function extractSubjects(payload, mode = 'natal') {
  let primary = null;
  for (const getter of SUBJECT_SOURCES) {
    const candidate = getter(payload);
    if (candidate && typeof candidate === 'object') {
      primary = candidate;
      break;
    }
  }

  let natal = null;
  for (const getter of NATAL_SOURCES) {
    const candidate = getter(payload);
    if (candidate && typeof candidate === 'object') {
      natal = candidate;
      break;
    }
  }

  if (mode === 'relationship' && !natal && payload?.first_subject) {
    natal = payload.first_subject;
  }

  return {
    primary,
    natal,
    snapshot: payload?.snapshot || null,
  };
}

export function collectPoints(subject) {
  const points = {};
  const houses = {};
  Object.entries(subject || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && value.point_type === 'AstrologicalPoint') {
      points[key] = value;
    } else if (value && typeof value === 'object' && value.point_type === 'House') {
      houses[key] = value;
    }
  });
  return { points, houses };
}

export const computeDecan = (position) => {
  if (!Number.isFinite(Number(position))) return null;
  const pos = Number(position);
  return Math.max(1, Math.min(3, Math.floor(pos / 10) + 1));
};

export const formatHouseName = (value) => {
  if (!value) return '';
  const spaced = String(value).replace(/_/g, ' ').replace(/House$/i, 'House');
  return spaced
    .split(' ')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : ''))
    .join(' ')
    .trim();
};

const fallbackValue = (...values) => {
  for (const val of values) {
    if (val === 0) return 0;
    if (val) return val;
  }
  return '';
};

export const simplifyAspect = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const name = fallbackValue(entry.name, entry.aspect, entry.id, entry.type, 'Aspect');
  const left = fallbackValue(entry.left, entry.first_point, entry.inner_point, entry.point_a, entry.planet_a);
  const right = fallbackValue(entry.right, entry.second_point, entry.outer_point, entry.point_b, entry.planet_b);
  const orb = fallbackValue(entry.orb, entry.orb_value, entry.orb_value_deg);
  return { name, left, right, orb };
};

export function extractAspects(payload) {
  const source = payload?.snapshot || payload || {};
  const aspectsRaw = source.aspects || payload?.aspects || [];
  const natalAspectsRaw = source.natal_aspects || payload?.natal_aspects || [];
  const majorAspects = Array.isArray(source.major_aspects) ? source.major_aspects : payload?.major_aspects || [];
  const natalMajorAspects = Array.isArray(source.natal_major_aspects)
    ? source.natal_major_aspects
    : payload?.natal_major_aspects || [];

  return {
    aspects: Array.isArray(aspectsRaw) ? aspectsRaw.map(simplifyAspect).filter(Boolean) : [],
    natalAspects: Array.isArray(natalAspectsRaw) ? natalAspectsRaw.map(simplifyAspect).filter(Boolean) : [],
    majorAspects: Array.isArray(majorAspects) ? majorAspects : [],
    natalMajorAspects: Array.isArray(natalMajorAspects) ? natalMajorAspects : [],
  };
}
