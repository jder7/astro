import { fallback, formatDateTime, formatDegree, ucfirst } from './format';

const POINT_LABELS = {
  sun: 'Sun',
  moon: 'Moon',
  ascendant: 'Ascendant',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
  medium_coeli: 'MC',
};

const ELEMENT_COLOR = {
  Fire: 'text-amber-300',
  Earth: 'text-lime-300',
  Air: 'text-cyan-300',
  Water: 'text-sky-300',
};

const qualityClass = {
  Cardinal: 'bg-slate-800 text-cyan-200',
  Fixed: 'bg-slate-800 text-fuchsia-200',
  Mutable: 'bg-slate-800 text-emerald-200',
};

function computeDecan(position) {
  if (!Number.isFinite(Number(position))) return null;
  const pos = Number(position);
  return Math.max(1, Math.min(3, Math.floor(pos / 10) + 1));
}

function asPointSummary(point, key) {
  if (!point || typeof point !== 'object') return null;
  const decan = computeDecan(point.position ?? point.orb ?? (point.abs_pos ? point.abs_pos % 30 : null));
  return {
    key,
    label: POINT_LABELS[key] || ucfirst(key),
    sign: point.sign || point.sign_name || '—',
    quality: point.quality || '',
    element: point.element || '',
    degree: formatDegree(point.position ?? (point.abs_pos ? point.abs_pos % 30 : null)),
    decan,
    emoji: point.emoji,
  };
}

function extractPoints(subject) {
  if (!subject || typeof subject !== 'object') return [];
  const keys = ['sun', 'moon', 'ascendant', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  return keys
    .map((key) => asPointSummary(subject[key], key))
    .filter(Boolean);
}

function buildMeta(subject, fallbackLabel) {
  const date = subject?.iso_formatted_local_datetime || subject?.iso_formatted_utc_datetime;
  const tz = subject?.tz_str;
  const location = [subject?.city, subject?.nation].filter(Boolean).join(', ');
  return {
    title: subject?.name || fallbackLabel,
    datetime: date || '',
    tz,
    location,
  };
}

function mapRangeEntry(entry) {
  if (!entry) return null;
  const start = formatDateTime(entry.anchor || entry.start || entry.timestamp || entry?.start_time || null);
  const end = formatDateTime(entry.end || entry?.end_time || null);
  return {
    start,
    end,
    label: entry.label || entry.id,
    sign: entry.sign,
    element: entry.element,
  };
}

function collectRanges(response) {
  if (!response || typeof response !== 'object') return [];
  const buckets = ['ascendant_day_range', 'moon_month_range', 'sun_year_range'];
  const ranges = [];
  buckets.forEach((key) => {
    const entries = response[key];
    if (Array.isArray(entries) && entries.length) {
      ranges.push({
        key,
        label: key.replace(/_/g, ' '),
        entries: entries.map((entry) => mapRangeEntry(entry)).filter(Boolean),
      });
    }
  });
  return ranges;
}

function pickAspects(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.slice(0, 12);
  if (Array.isArray(data?.major_aspects)) return data.major_aspects.slice(0, 12);
  if (Array.isArray(data?.aspects)) return data.aspects.slice(0, 12);
  return [];
}

function simplifyAspect(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const name = entry.name || entry.aspect || entry.id || 'Aspect';
  const left = fallback(entry.left, entry.first_point, entry.inner_point, entry.point_a, entry.planet_a);
  const right = fallback(entry.right, entry.second_point, entry.outer_point, entry.point_b, entry.planet_b);
  const orb = fallback(entry.orb, entry.orb_value, entry.orb_value_deg);
  return {
    name,
    left,
    right,
    orb,
  };
}

export function buildSummary(mode, response, birthParts, transitParts) {
  const sections = [];
  const ranges = collectRanges(response || {});
  let aspects = [];

  if (mode === 'natal' && response?.subject) {
    sections.push({ meta: buildMeta(response.subject, 'Natal'), points: extractPoints(response.subject) });
    aspects = pickAspects(response.major_aspects || response.aspects).map(simplifyAspect).filter(Boolean);
  } else if ((mode === 'transit' || mode === 'natal_transit') && response?.snapshot) {
    const snap = response.snapshot;
    if (snap.subject) {
      sections.push({ meta: buildMeta(snap.subject, 'Transit sky'), points: extractPoints(snap.subject) });
    }
    if (snap.natal_subject) {
      sections.push({ meta: buildMeta(snap.natal_subject, 'Natal'), points: extractPoints(snap.natal_subject) });
    }
    aspects = pickAspects(snap.major_aspects || snap.aspects).map(simplifyAspect).filter(Boolean);
  } else if (mode === 'relationship' && response) {
    if (response.first_subject) {
      sections.push({ meta: buildMeta(response.first_subject, 'Partner A'), points: extractPoints(response.first_subject) });
    }
    if (response.second_subject) {
      sections.push({ meta: buildMeta(response.second_subject, 'Partner B'), points: extractPoints(response.second_subject) });
    }
    aspects = pickAspects(response.aspects).map(simplifyAspect).filter(Boolean);
  }

  const context = {
    birth: birthParts ? formatDateTime(birthParts) : '',
    transit: transitParts ? formatDateTime(transitParts) : '',
  };

  return { sections, ranges, aspects, context };
}

export function classesForPoint(point) {
  const classes = [];
  if (point?.element && ELEMENT_COLOR[point.element]) classes.push(ELEMENT_COLOR[point.element]);
  if (point?.quality && qualityClass[point.quality]) classes.push(qualityClass[point.quality]);
  return classes.join(' ');
}
