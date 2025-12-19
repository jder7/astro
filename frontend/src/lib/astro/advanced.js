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

const normalizeLabel = (value) => String(value || '').trim().replace(/\s+/g, '_').toLowerCase();

const buildPointMap = (subject = {}) => {
  const map = new Map();
  Object.values(subject || {}).forEach((value) => {
    if (value && typeof value === 'object' && value.point_type === 'AstrologicalPoint') {
      const key = normalizeLabel(value.name || value.id);
      map.set(key, value);
    }
  });
  return map;
};

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

export const simplifyAspect = (entry, ownerLabel = '') => {
  if (!entry || typeof entry !== 'object') return null;
  const name = fallbackValue(entry.name, entry.aspect, entry.id, entry.type, 'Aspect');
  const left = fallbackValue(entry.left, entry.first_point, entry.inner_point, entry.point_a, entry.planet_a);
  const right = fallbackValue(entry.right, entry.second_point, entry.outer_point, entry.point_b, entry.planet_b);
  const orb = fallbackValue(entry.orb, entry.orb_value, entry.orb_value_deg, entry.orbit, entry.diff);
  const taggedLeft = ownerLabel && left ? `${left} (${ownerLabel})` : left;
  const taggedRight = ownerLabel && right ? `${right} (${ownerLabel})` : right;
  return { name, left: taggedLeft, right: taggedRight, orb, leftRef: left, rightRef: right, movement: entry.aspect_movement || entry.movement || '' };
};

export function extractAspects(payload) {
  const source = payload?.snapshot || payload || {};
  const primaryName =
    source.subject?.name ||
    payload?.subject?.name ||
    payload?.snapshot?.subject?.name ||
    payload?.first_subject?.name ||
    'Subject 1';
  const secondaryName =
    source.natal_subject?.name ||
    payload?.natal_subject?.name ||
    payload?.second_subject?.name ||
    (payload?.first_subject && payload?.second_subject ? payload.second_subject.name : '') ||
    'Subject 2';

  const aspectsRaw = source.aspects || payload?.aspects || [];
  const natalAspectsRaw = source.natal_aspects || payload?.natal_aspects || [];
  const majorAspects = Array.isArray(source.major_aspects) ? source.major_aspects : payload?.major_aspects || [];
  const natalMajorAspects = Array.isArray(source.natal_major_aspects)
    ? source.natal_major_aspects
    : payload?.natal_major_aspects || [];

  const subject1Data = source.subject || payload?.subject || payload?.snapshot?.subject || payload?.first_subject || {};
  const subject2Data = source.natal_subject || payload?.natal_subject || payload?.second_subject || {};

  const subject1PointMap = buildPointMap(subject1Data);
  const subject2PointMap = buildPointMap(subject2Data);

  const findSign = (name, owner = '1') => {
    const key = normalizeLabel(name);
    if (!key) return '';
    if (owner === '2') {
      return subject2PointMap.get(key)?.sign || subject1PointMap.get(key)?.sign || '';
    }
    return subject1PointMap.get(key)?.sign || subject2PointMap.get(key)?.sign || '';
  };

  const isRelationship = aspectsRaw && typeof aspectsRaw === 'object' && !Array.isArray(aspectsRaw);
  const synastryAspectsRaw = isRelationship && Array.isArray(aspectsRaw.aspects) ? aspectsRaw.aspects : [];
  const subject1AspectsRaw = isRelationship && Array.isArray(aspectsRaw.first_subject) ? aspectsRaw.first_subject : [];
  const subject2AspectsRaw = isRelationship && Array.isArray(aspectsRaw.second_subject) ? aspectsRaw.second_subject : [];

  const mapRelationshipAspect = (entry, ownerTagLeft = '', ownerTagRight = '') => {
    if (!entry || typeof entry !== 'object') return null;
    const leftRaw = entry.p1_name || entry.left || entry.point_a || entry.first_point;
    const rightRaw = entry.p2_name || entry.right || entry.point_b || entry.second_point;
    const left = leftRaw ? `${leftRaw}${entry.p1_owner ? ` (${entry.p1_owner})` : ownerTagLeft ? ` (${ownerTagLeft})` : ''}` : '';
    const right = rightRaw
      ? `${rightRaw}${entry.p2_owner ? ` (${entry.p2_owner})` : ownerTagRight ? ` (${ownerTagRight})` : ''}`
      : '';
    const orb = fallbackValue(entry.orbit, entry.diff, entry.orb, entry.orb_value, entry.orb_value_deg);
    const movement = entry.aspect_movement || entry.movement || '';
    const signLeft = findSign(leftRaw, '1');
    const signRight = findSign(rightRaw, '2');
    return {
      name: fallbackValue(entry.aspect, entry.name, 'Aspect'),
      left,
      right,
      leftRef: leftRaw,
      rightRef: rightRaw,
      orb,
      leftOwner: '1',
      rightOwner: '2',
      signLeft,
      signRight,
      movement,
    };
  };

  const mapAspect = (entry, ownerLeft = '1', ownerRight = '1') => {
    if (!entry || typeof entry !== 'object') return null;
    const base = simplifyAspect(entry);
    const signLeft = findSign(base.leftRef, ownerLeft);
    const signRight = findSign(base.rightRef, ownerRight);
    return {
      ...base,
      leftOwner: ownerLeft,
      rightOwner: ownerRight,
      signLeft,
      signRight,
    };
  };

  const subject1Aspects = isRelationship
    ? subject1AspectsRaw.map((a) => mapRelationshipAspect(a, '1', '')).filter(Boolean)
    : Array.isArray(aspectsRaw)
      ? aspectsRaw.map((a) => mapAspect(a, '1', '1')).filter(Boolean)
      : [];
  const subject2Aspects = isRelationship
    ? subject2AspectsRaw.map((a) => mapRelationshipAspect(a, '', '2')).filter(Boolean)
    : Array.isArray(natalAspectsRaw)
      ? natalAspectsRaw.map((a) => mapAspect(a, '2', '2')).filter(Boolean)
      : [];
  const synastryAspects = synastryAspectsRaw
    .map((a) => (isRelationship ? mapRelationshipAspect(a) : mapAspect(a, '1', '2')))
    .filter(Boolean);

  return {
    subject1: {
      name: primaryName,
      aspects: subject1Aspects,
      majorAspects: Array.isArray(majorAspects) ? majorAspects : [],
    },
    subject2: {
      name: secondaryName,
      aspects: subject2Aspects,
      majorAspects: Array.isArray(natalMajorAspects) ? natalMajorAspects : [],
    },
    synastry: {
      aspects: synastryAspects,
      majorAspects: [],
    },
  };
}
