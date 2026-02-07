const clampNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeBirth = (raw, defaults) => ({
  name: (raw?.name || defaults.name || 'Subject').trim() || 'Subject',
  year: clampNumber(raw?.year, defaults.year),
  month: clampNumber(raw?.month, defaults.month),
  day: clampNumber(raw?.day, defaults.day),
  hour: clampNumber(raw?.hour, defaults.hour ?? 12),
  minute: clampNumber(raw?.minute, defaults.minute ?? 0),
  lat: clampNumber(raw?.lat, defaults.lat),
  lng: clampNumber(raw?.lng, defaults.lng),
  tz_str: raw?.tz_str || defaults.tz_str,
  city: raw?.city || defaults.city,
  nation: raw?.nation || defaults.nation,
});

const normalizeMoment = (raw, defaults) => ({
  year: clampNumber(raw?.year, defaults.year),
  month: clampNumber(raw?.month, defaults.month),
  day: clampNumber(raw?.day, defaults.day),
  hour: clampNumber(raw?.hour, defaults.hour ?? 12),
  minute: clampNumber(raw?.minute, defaults.minute ?? 0),
  lat: clampNumber(raw?.lat, defaults.lat),
  lng: clampNumber(raw?.lng, defaults.lng),
  tz_str: raw?.tz_str || defaults.tz_str,
  city: raw?.city || defaults.city,
  nation: raw?.nation || defaults.nation,
});

const defaultBirth = {
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
};

const defaultTransit = {
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
};

const normalizeConfig = (config) => {
  const activePoints = Array.isArray(config?.active_points) && config.active_points.length
    ? config.active_points
    : ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'ascendant'];
  return {
    perspective: config?.perspective || 'Topocentric',
    zodiac_type: config?.zodiac_type || 'Sidereal',
    sidereal_mode: (config?.zodiac_type || 'Sidereal') === 'Sidereal' ? config?.sidereal_mode || 'KRISHNAMURTI' : null,
    house_system: config?.house_system || 'P',
    theme: config?.theme || 'dark',
    active_points: activePoints,
  };
};

const partsFromBirth = (birth) => ({
  year: birth.year,
  month: birth.month,
  day: birth.day,
  hour: birth.hour,
  minute: birth.minute,
});

export function buildChartPayload(mode, state, config) {
  const normalizedConfig = normalizeConfig(config);
  const birth = normalizeBirth(state?.birth, defaultBirth);
  const moment = normalizeMoment(state?.transit, defaultTransit);

  const base = {
    asc_moon_sun_range_enabled: Boolean(config?.asc_moon_sun_range_enabled),
    config: normalizedConfig,
  };

  if (mode === 'natal') {
    return { payload: { ...base, birth }, birthParts: partsFromBirth(birth), transitParts: null };
  }
  if (mode === 'transit') {
    return { payload: { ...base, birth: null, moment }, birthParts: null, transitParts: partsFromBirth(moment) };
  }
  if (mode === 'natal_transit') {
    return {
      payload: { ...base, birth, moment },
      birthParts: partsFromBirth(birth),
      transitParts: partsFromBirth(moment),
    };
  }
  if (mode === 'relationship') {
    const first = normalizeBirth(state?.relationship?.first, defaultBirth);
    const second = normalizeBirth(state?.relationship?.second, { ...defaultBirth, name: 'Partner B' });
    return { payload: { ...base, birth: null, moment: null, first, second }, birthParts: null, transitParts: null };
  }
  return { payload: { ...base, moment }, birthParts: partsFromBirth(birth), transitParts: partsFromBirth(moment) };
}

export function buildReportPayload(mode, state, config) {
  const { payload } = buildChartPayload(mode, state, config);
  // Ensure birth is always present for the report API (required field).
  const { payload: natalPayload } = buildChartPayload('natal', state, config);

  // Transit/dual reports also need a moment; reuse transit normalization when missing.
  const { payload: transitPayload } = buildChartPayload('transit', state, config);
  const moment = payload.moment || transitPayload.moment || null;

  let birth = payload.birth || natalPayload.birth;
  if (mode === 'transit' && moment) {
    birth = {
      name: 'Transit',
      year: moment.year,
      month: moment.month,
      day: moment.day,
      hour: moment.hour,
      minute: moment.minute,
      lat: moment.lat,
      lng: moment.lng,
      tz_str: moment.tz_str,
      city: moment.city,
      nation: moment.nation,
    };
  } else if (mode === 'relationship' && payload.first) {
    birth = payload.first;
  }

  const kind = mode === 'transit' ? 'SUBJECT' : 'NATAL';
  const includeAspects = true;
  return {
    ...payload,
    birth,
    ...(mode === 'transit' || mode === 'natal_transit' ? { moment } : {}),
    mode,
    kind,
    include_aspects: includeAspects,
    max_aspects: 48,
  };
}

export function buildRangePayload(state, config, range, includeNatal = true) {
  const normalizedConfig = normalizeConfig(config);
  const startMoment = normalizeMoment(range?.start, state?.transit || defaultTransit);
  const moment = normalizeMoment(startMoment, defaultTransit);
  const end = normalizeMoment(range?.end, { ...moment, day: (moment.day || 1) + 1 });
  const birth = includeNatal && state?.mode !== 'transit' ? normalizeBirth(state?.birth, defaultBirth) : null;
  const granularity = String(range?.granularity || 'hour').toLowerCase();

  return {
    asc_moon_sun_range_enabled: Boolean(config?.asc_moon_sun_range_enabled),
    include_aspects: Boolean(range?.include_aspects ?? config?.include_aspects),
    granularity,
    moment,
    end,
    birth,
    config: normalizedConfig,
  };
}

export function buildTimeRangeSweepsRequest(mode, state, config, targets = []) {
  const { payload } = buildChartPayload(mode, state, config);
  const safeTargets = Array.isArray(targets) && targets.length ? targets : ['ascendant', 'moon', 'sun'];
  const birth = payload.birth || null;
  const moment = payload.moment || null;
  const first = payload.first || null;
  const second = payload.second || null;
  return {
    mode,
    targets: safeTargets,
    birth,
    moment,
    first,
    second,
    config: payload.config,
  };
}
