const POINT_RANGE_KEYS = ['pointSignRange', 'point_sign_range'];

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

const pickList = (payload, keys = []) => {
  const source = payload?.snapshot || payload || {};
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key];
  }
  return Array.isArray(source) ? source : [];
};

export function extractPointSignRanges(payload) {
  return pickList(payload, POINT_RANGE_KEYS);
}

const normalizePointKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

export function extractPointRanges(payload, targetKey) {
  const ranges = extractPointSignRanges(payload) || [];
  const target = normalizePointKey(targetKey);
  return ranges.filter((range) => normalizePointKey(range?.point_key || range?.pointKey || range?.point) === target);
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

  if (mode === 'relationship') {
    if (payload?.first_subject) {
      primary = payload.first_subject;
    }
    if (payload?.second_subject) {
      natal = payload.second_subject;
    } else if (!natal && payload?.first_subject) {
      natal = payload.first_subject;
    }
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
    } else if (value && typeof value === 'object' && (value.point_type === 'House' || key.toLowerCase().includes('house'))) {
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

const pickArray = (...values) => {
  for (const val of values) {
    if (Array.isArray(val)) return val;
  }
  return [];
};

export function extractAspects(payload, mode = 'natal') {
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
  const majorAspects = pickArray(
    source.major_aspects,
    source.majorAspects,
    source.subject?.major_aspects,
    source.subject?.majorAspects,
    payload?.major_aspects,
    payload?.majorAspects,
    payload?.subject?.major_aspects,
    payload?.subject?.majorAspects,
    payload?.snapshot?.subject?.major_aspects,
    payload?.snapshot?.subject?.majorAspects
  );
  const natalMajorAspects = pickArray(
    source.natal_major_aspects,
    source.natalMajorAspects,
    source.natal_subject?.major_aspects,
    source.natal_subject?.majorAspects,
    payload?.natal_major_aspects,
    payload?.natalMajorAspects,
    payload?.natal_subject?.major_aspects,
    payload?.natal_subject?.majorAspects,
    payload?.snapshot?.natal_subject?.major_aspects,
    payload?.snapshot?.natal_subject?.majorAspects
  );

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

  const isRelationship = mode === 'relationship' || Boolean(payload?.synastry);
  const synastrySource = isRelationship ? payload?.synastry : payload?.snapshot?.synastry || payload?.synastry || null;
  const synastryAspectsRaw = pickArray(
    synastrySource?.aspects,
    synastrySource?.dual_chart_aspects,
    synastrySource?.aspects_list,
    synastrySource?.aspect_list
  );
  const synastryMajorAspects = pickArray(
    source.synastry_major_aspects,
    source.synastryMajorAspects,
    payload?.synastry_major_aspects,
    payload?.synastryMajorAspects
  );
  const subject1AspectsRaw = isRelationship ? (Array.isArray(aspectsRaw) ? aspectsRaw : []) : [];
  const subject2AspectsRaw = isRelationship ? (Array.isArray(natalAspectsRaw) ? natalAspectsRaw : []) : [];
  const synastryUsesOwners = synastryAspectsRaw.some(
    (entry) => entry && (entry.p1_name || entry.p2_name || entry.p1_owner || entry.p2_owner)
  );

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

  let subject1Aspects = isRelationship
    ? subject1AspectsRaw.map((a) => mapAspect(a, '1', '1')).filter(Boolean)
    : Array.isArray(aspectsRaw)
      ? aspectsRaw.map((a) => mapAspect(a, '1', '1')).filter(Boolean)
      : [];
  let subject2Aspects = isRelationship
    ? subject2AspectsRaw.map((a) => mapAspect(a, '2', '2')).filter(Boolean)
    : Array.isArray(natalAspectsRaw)
      ? natalAspectsRaw.map((a) => mapAspect(a, '2', '2')).filter(Boolean)
      : [];
  const synastryAspects = synastryAspectsRaw
    .map((a) => (synastryUsesOwners || isRelationship ? mapRelationshipAspect(a) : mapAspect(a, '1', '2')))
    .filter(Boolean);
  return {
    majorAspects,
    natalMajorAspects,
    subject1: {
      name: primaryName,
      aspects: subject1Aspects,
      majorAspects,
    },
    subject2: {
      name: secondaryName,
      aspects: subject2Aspects,
      majorAspects: natalMajorAspects,
    },
    synastry: {
      aspects: synastryAspects,
      majorAspects: synastryMajorAspects,
    },
  };
}
