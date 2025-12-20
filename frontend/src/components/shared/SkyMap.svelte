<script>
  import ElementSigil from '$components/shared/ElementSigil.svelte';
  import { ELEMENT_HEX, ELEMENT_ICON, QUALITY_ICON, POINT_SYMBOLS, signName, signSymbol, DAY_RULERS } from '$lib/astro/signs';

  export let ranges = [];
  export let pointsByRangeId = {};

  const uid = `sky-${Math.random().toString(36).slice(2, 8)}`;
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;

  const PLANET_COLORS = {
    sun: '#f5c542',
    moon: '#dce4f0',
    mercury: '#f3dd67',
    venus: '#58d09a',
    mars: '#ef4444',
    jupiter: '#9c7bff',
    saturn: '#f3a4c1',
    uranus: '#3ed4d8',
    neptune: '#245ad1',
    pluto: '#cfd4dc',
    ascendant: '#a855f7',
    medium_coeli: '#f59e0b',
  };

  const PLANET_SIZE = {
    xs: 6,
    sm: 8,
    md: 10,
    lg: 12,
    xl: 14,
  };

  const PLANET_KEYS = new Set(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']);

  const POLARITY_ICON = {
    expressive: '➕',
    receptive: '➖',
  };

  const POLARITY_FROM_ELEMENT = {
    Fire: 'expressive',
    Air: 'expressive',
    Earth: 'receptive',
    Water: 'receptive',
  };

  const SIGN_ORDER = ['ari', 'tau', 'gem', 'can', 'leo', 'vir', 'lib', 'sco', 'sag', 'cap', 'aqu', 'pis'];

  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  const hexToRgb = (hex) => {
    if (typeof hex !== 'string') return null;
    const cleaned = hex.replace('#', '');
    const chunked = cleaned.length === 3 ? cleaned.split('').map((c) => c + c) : cleaned.match(/.{1,2}/g);
    if (!chunked || chunked.length < 3) return null;
    const [r, g, b] = chunked.slice(0, 3).map((p) => parseInt(p, 16));
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  };

  const adjustHex = (hex, amount = 0) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const t = amount >= 0 ? 255 : 0;
    const p = clamp01(Math.abs(amount));
    const mix = (c) => Math.round((t - c) * p + c);
    const r = mix(rgb.r);
    const g = mix(rgb.g);
    const b = mix(rgb.b);
    return `#${[r, g, b]
      .map((n) => {
        const clamped = Math.min(255, Math.max(0, n));
        return clamped.toString(16).padStart(2, '0');
      })
      .join('')}`;
  };

  const toRgba = (color, alpha = 1) => {
    const fallback = `rgba(56, 189, 248, ${alpha})`;
    if (typeof color !== 'string') return fallback;
    const hex = color.replace('#', '');
    const parts = hex.length === 3 ? hex.split('').map((c) => c + c) : hex.match(/.{1,2}/g);
    if (!parts || parts.length < 3) return fallback;
    const ints = parts.slice(0, 3).map((p) => parseInt(p, 16));
    if (ints.some((n) => !Number.isFinite(n))) return fallback;
    const [r, g, b] = ints;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const normalizePointKey = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

  const normalizeRangeId = (value) => (typeof value === 'string' ? value.toLowerCase() : null);

  const safeDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const d = value ? new Date(value) : null;
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
    return null;
  };

  const signNumFrom = (sign) => {
    const key = String(sign || '').slice(0, 3).toLowerCase();
    const idx = SIGN_ORDER.indexOf(key);
    return idx === -1 ? null : idx;
  };

  const pickFirstSignNum = (range) => {
    const firstEntry = Array.isArray(range?.entries)
      ? range.entries.find((e) => e && (typeof e.sign_num === 'number' || typeof e.signNum === 'number' || e.sign))
      : null;
    if (!firstEntry) return null;
    if (typeof firstEntry.sign_num === 'number') return firstEntry.sign_num;
    if (typeof firstEntry.signNum === 'number') return firstEntry.signNum;
    return signNumFrom(firstEntry.sign);
  };

  const formatSignDate = (date, anchorYear) => {
    const d = safeDate(date);
    if (!d) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const suffix = d.getFullYear() === anchorYear ? '' : `-${String(d.getFullYear()).slice(-2)}`;
    return `${day}-${month}${suffix}`;
  };

  const formatDateTimeShort = (date) => {
    const d = safeDate(date);
    if (!d) return '—';
    try {
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  };

  const describeArc = (cx, cy, radius, startAngle, endAngle) => {
    const start = polarToCartesian(cx, cy, radius, startAngle);
    const end = polarToCartesian(cx, cy, radius, endAngle);
    const sweep = normalizeAngle(endAngle - startAngle);
    const largeArcFlag = sweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  const normalizeAngle = (deg) => {
    const m = deg % 360;
    return m < 0 ? m + 360 : m;
  };

  const polarToCartesian = (cx, cy, radius, angleDeg) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    const x = cx + radius * Math.cos(rad);
    const y = cy + radius * Math.sin(rad);
    return { x, y };
  };

  const resolvePolarity = (element) => {
    const key = POLARITY_FROM_ELEMENT[element] || 'expressive';
    return {
      key,
      symbol: POLARITY_ICON[key] || '➕',
      label: key === 'expressive' ? 'Expressive' : 'Receptive',
    };
  };

  const resolvePointSize = (key) => {
    const norm = normalizePointKey(key);
    if (norm === 'sun') return PLANET_SIZE.xl;
    if (norm === 'moon' || norm === 'pluto') return PLANET_SIZE.xs;
    if (norm === 'mercury' || norm === 'venus' || norm === 'chiron' || norm === 'lilith' || norm === 'mean_lilith' || norm === 'black_moon_lilith')
      return PLANET_SIZE.sm;
    if (norm === 'mars') return PLANET_SIZE.md;
    if (norm === 'jupiter' || norm === 'saturn') return PLANET_SIZE.lg;
    if (norm === 'uranus' || norm === 'neptune') return PLANET_SIZE.md;
    if (norm === 'ascendant') return PLANET_SIZE.lg;
    if (norm === 'medium_coeli' || norm === 'mc') return PLANET_SIZE.md;
    return PLANET_SIZE.md;
  };

  const resolvePointColor = (key) => PLANET_COLORS[normalizePointKey(key)] || '#67e8f9';

  const angularDistance = (a, b) => {
    const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b)) % 360;
    return diff > 180 ? 360 - diff : diff;
  };

  const resolvePointAngleFromSegments = (point, segmentLookup) => {
    if (!point || !segmentLookup) return null;
    const rawSign = point.sign || point.sign_key || point.signKey || '';
    const signKey = rawSign.slice(0, 3).toLowerCase();
    const bySign = segmentLookup[rawSign] || segmentLookup[signKey] || segmentLookup[rawSign.toLowerCase()];
    const byNum = Number.isFinite(point.sign_num)
      ? Object.values(segmentLookup).find((seg) => seg.sign_num === point.sign_num)
      : null;
    const seg = bySign || byNum;
    if (!seg) return null;
    const pos = Number.isFinite(point.position)
      ? point.position
      : Number.isFinite(point.abs_pos)
        ? ((point.abs_pos % 30) + 30) % 30
        : null;
    const ratio = Number.isFinite(pos) ? clamp01(pos / 30) : 0.5;
    return seg.startDeg + seg.span * ratio;
  };

  const getDayRulerFromDate = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    return DAY_RULERS?.[date.getDay()] || null;
  };

  const pickPoint = (points, key) => {
    const target = normalizePointKey(key);
    return (
      Object.entries(points || {}).find(([k]) => normalizePointKey(k) === target)?.[1] ||
      points?.[key] ||
      null
    );
  };

  const buildSigilBase = (points, anchorDate) => {
    const safeAnchor = anchorDate instanceof Date && Number.isFinite(anchorDate.getTime()) ? anchorDate : new Date();
    const sun = pickPoint(points, 'sun');
    const moon = pickPoint(points, 'moon');
    const asc = pickPoint(points, 'ascendant');
    const dayKey = getDayRulerFromDate(safeAnchor);
    const day = dayKey ? pickPoint(points, dayKey) : null;
    return {
      sunElement: sun?.element || '',
      moonElement: moon?.element || '',
      ascElement: asc?.element || '',
      dayElement: day?.element || '',
      dayRulerKey: dayKey || '',
    };
  };

  const normalizeSunRange = (range, idx = 0) => {
    if (!range || typeof range !== 'object') return null;
    const id = String(range.id || range.label || `range-${idx}`);
    const entriesRaw = Array.isArray(range.entries) ? range.entries : [];
    const entries = entriesRaw
      .map((entry) => {
        const start = safeDate(entry.start || entry.timestamp || entry.start_timestamp || entry.startTimestamp);
        const endRaw = entry.end || entry.end_timestamp || entry.endTimestamp || entry.finish || entry.until || entry.to;
        const end = safeDate(endRaw);
        if (!start) return null;
        const resolvedEnd = end || new Date(start.getTime() + 32 * DAY_MS);
        return { ...entry, start, end: resolvedEnd };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);
    if (!entries.length) return null;
    const anchorDate = safeDate(range.anchor || range.anchor_timestamp || range.anchorTimestamp) || entries[0].start;
    return { ...range, id, label: range.label || id, anchor: anchorDate, entries };
  };

  const pickSkyRanges = (sunRanges = []) => {
    const priority = ['transit', 'first', 'second', 'natal'];
    const list = Array.isArray(sunRanges) ? [...sunRanges] : [];
    list.sort((a, b) => {
      const ai = priority.indexOf((a?.id || a?.label || '').toLowerCase());
      const bi = priority.indexOf((b?.id || b?.label || '').toLowerCase());
      const av = ai === -1 ? 99 : ai;
      const bv = bi === -1 ? 99 : bi;
      return av - bv;
    });
    return list.slice(0, 2);
  };

  const renderDiscOutlines = (radii) => [
    { r: radii.segmentOuter, stroke: 'rgba(226,232,240,0.26)', width: 0.9 },
    { r: radii.segmentInner, stroke: 'rgba(226,232,240,0.2)', width: 0.75 },
    { r: radii.quality, stroke: 'rgba(226,232,240,0.18)', width: 0.7 },
    { r: radii.element, stroke: 'rgba(226,232,240,0.14)', width: 0.6 },
    { r: radii.polarity, stroke: 'rgba(226,232,240,0.12)', width: 0.6 },
  ];

  function buildSignDisc(segments, radii, cx, cy, accent, anchorYear, defs, rangeKey, isInnerLayer) {
    const spans = [];
    const decans = [];
    const labels = [];
    const dates = [];
    const separators = [];

    segments.forEach((seg, idx) => {
      const baseColor = ELEMENT_HEX[seg.element] || ELEMENT_HEX.Default;
      const tone = toRgba(baseColor, 0.62);
      const fullWidth = radii.segmentOuter - radii.polarity;
      const midRadius = radii.polarity + fullWidth / 2;
      spans.push({
        d: describeArc(cx, cy, midRadius, seg.startDeg, seg.endDeg),
        stroke: tone,
        width: fullWidth,
      });

      [seg.decan1, seg.decan2].forEach((angle) => {
        const inner = radii.segmentInner - 2;
        const outer = radii.segmentOuter + 6;
        const startPt = polarToCartesian(cx, cy, inner, angle);
        const endPt = polarToCartesian(cx, cy, outer, angle);
        decans.push({ x1: startPt.x, y1: startPt.y, x2: endPt.x, y2: endPt.y });
      });

      const namePathId = `sign-name-${uid}-${rangeKey}-${idx}`;
      defs.push({ type: 'path', id: namePathId, d: describeArc(cx, cy, radii.text, seg.startDeg, seg.endDeg) });
      const labelStyle = `fill:${adjustHex(accent, 0.1)}${isInnerLayer ? ';font-size:0.62rem' : ''}`;
      labels.push({
        pathId: namePathId,
        text: seg.signMeta.name || seg.sign || `Sign ${idx + 1}`,
        style: labelStyle,
      });

      const datePathId = `sign-date-${uid}-${rangeKey}-${idx}`;
      defs.push({ type: 'path', id: datePathId, d: describeArc(cx, cy, radii.date, seg.startDeg, seg.endDeg) });
      dates.push({
        pathId: datePathId,
        text: formatSignDate(seg.start, anchorYear),
        color: adjustHex(accent, -0.05),
      });

      const sepInner = radii.polarity - 6;
      const sepOuter = radii.date + 6;
      const sepStart = polarToCartesian(cx, cy, sepInner, seg.startDeg);
      const sepEnd = polarToCartesian(cx, cy, sepOuter, seg.startDeg);
      separators.push({ x1: sepStart.x, y1: sepStart.y, x2: sepEnd.x, y2: sepEnd.y });
    });

    return { spans, decans, labels, dates, separators };
  }

  const buildElementQualityDisc = (segments, radii, cx, cy) => {
    const eqRadius = (radii.element + radii.quality) / 2;
    return segments.map((seg) => {
      const transform = `translate(${cx} ${cy}) rotate(${seg.midDeg}) translate(0 ${-eqRadius})`;
      return {
        transform,
        title: `Element ${seg.element || '—'} · Quality ${seg.quality || '—'}`,
        content: `${ELEMENT_ICON[seg.element] || ''} ${QUALITY_ICON[seg.quality] || ''}`,
      };
    });
  };

  const buildPolarityDisc = (segments, radii, cx, cy) => {
    const polRadius = Math.max(6, radii.polarity - 10);
    return segments.map((seg) => {
      const pol = resolvePolarity(seg.element);
      const transform = `translate(${cx} ${cy}) rotate(${seg.midDeg}) translate(0 ${-polRadius})`;
      return { transform, symbol: pol.symbol, title: pol.label };
    });
  };

  function buildPlanetDisc({ cx, cy, radii, rangeKey, pointsByRangeId, signLookup, currentSeg, anchor, sunPolarity, centerSignMeta, defs }) {
    const rangePoints = pointsByRangeId?.[rangeKey] || pointsByRangeId?.default || {};
    const bandOuter = radii.segmentOuter - 2;
    const bandInner = Math.max(radii.element - 10, radii.polarity + 8);
    const planetTrack = (bandOuter + bandInner) / 2;
    const pointEntries = Object.entries(rangePoints || {}).filter(([, val]) => val && typeof val === 'object');
    const placedPoints = [];
    const points = [];

    pointEntries
      .map(([key, point]) => ({ key, point, size: resolvePointSize(normalizePointKey(key)) }))
      .sort((a, b) => b.size - a.size)
      .forEach(({ key, point, size: presetSize }, idx) => {
        const normKey = normalizePointKey(key);
        if (normKey === 'sun') return;
        const angle = resolvePointAngleFromSegments(point, signLookup);
        if (!Number.isFinite(angle)) return;
        const baseRadius = planetTrack;
        const baseSize = presetSize || resolvePointSize(normKey);
        const conflict = placedPoints.find((p) => angularDistance(p.angle, angle) < 7 && p.radius === baseRadius);
        const radius = conflict ? Math.max(bandInner + baseSize * 0.3, baseRadius - baseSize * 0.6) : baseRadius;
        const size = conflict ? Math.max(PLANET_SIZE.xs, baseSize * 0.9) : baseSize;
        placedPoints.push({ angle, radius });

        const baseColor = resolvePointColor(normKey);
        const gradId = `${rangeKey}-planet-${normKey}-${idx}-${cx}-${cy}`;
        defs.push({
          type: 'radialGradient',
          id: gradId,
          cx: '50%',
          cy: '40%',
          r: '65%',
          stops: [
            { offset: '0%', color: adjustHex(baseColor, 0.32), opacity: 0.96 },
            { offset: '65%', color: baseColor, opacity: 0.95 },
            { offset: '100%', color: adjustHex(baseColor, -0.18), opacity: 0.88 },
          ],
        });

        const coords = polarToCartesian(cx, cy, radius, angle);
        const pol = resolvePolarity(point.element || signLookup[point.sign]?.element);
        const signNameLabel = signName(point.sign || signLookup[point.sign]?.sign);
        const orbVal = Number.isFinite(point.position)
          ? point.position
          : Number.isFinite(point.abs_pos)
            ? ((point.abs_pos % 30) + 30) % 30
            : null;
        const orbText = Number.isFinite(orbVal) ? `${orbVal.toFixed(2)}°` : '—';
        const title = `${point.name || key}${signNameLabel ? ` · ${signNameLabel}` : ''} ${orbText} ${ELEMENT_ICON[point.element] || ''} ${pol.symbol} ${pol.label}`;
        const icon = POINT_SYMBOLS[normKey] || POINT_SYMBOLS[normalizePointKey(point.name)] || '';
        const ring = normKey === 'saturn' ? 'saturn' : normKey === 'uranus' ? 'uranus' : null;
        const shape = PLANET_KEYS.has(normKey) ? 'planet' : 'triangle';
        points.push({
          key: normKey,
          x: coords.x,
          y: coords.y,
          size,
          gradientId: gradId,
          icon: icon || '▲',
          title,
          ring,
          shape,
        });
      });

    const sunPoint = pickPoint(rangePoints, 'sun') || {};
    const sunColor = resolvePointColor('sun');
    const sunGradId = `${rangeKey}-sun-${cx}-${cy}`;
    defs.push({
      type: 'radialGradient',
      id: sunGradId,
      cx: '50%',
      cy: '35%',
      r: '65%',
      stops: [
        { offset: '0%', color: adjustHex(sunColor, 0.4), opacity: 1 },
        { offset: '65%', color: sunColor, opacity: 0.95 },
        { offset: '100%', color: adjustHex(sunColor, -0.2), opacity: 0.9 },
      ],
    });
    const sunSpan = currentSeg ? currentSeg.end.getTime() - currentSeg.start.getTime() : 1;
    const sunAngle = currentSeg
      ? currentSeg.startDeg + ((anchor?.getTime?.() - currentSeg.start.getTime()) / Math.max(1, sunSpan)) * currentSeg.span
      : -90;
    const sunCoords = polarToCartesian(cx, cy, planetTrack, sunAngle);
    const sunTitle = `Sun · ${centerSignMeta.name || 'Sun'} ${sunPolarity.symbol} ${sunPolarity.label}`;
    const sun = {
      x: sunCoords.x,
      y: sunCoords.y,
      gradientId: sunGradId,
      r1: PLANET_SIZE.xl + 5,
      r2: PLANET_SIZE.xl + 1,
      icon: POINT_SYMBOLS.sun || '☉',
      title: sunTitle,
    };

    return { points, sun };
  }

  function buildSkyMapLayer(range, opts = {}) {
    const { cx, cy, layerIndex = 0, layerCount = 1, defs = [], pointsByRangeId = {}, rotationOffset = 0 } = opts;
    if (!range) return null;
    const entries = (Array.isArray(range.entries) ? range.entries : [])
      .map((entry) => {
        const start = safeDate(entry.start || entry.timestamp);
        const end = safeDate(entry.end);
        if (!(start && end && end > start)) return null;
        return { ...entry, start, end };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);
    const anchor = safeDate(range.anchor) || entries[0]?.start;
    const anchorYear = anchor?.getFullYear() || new Date().getFullYear();
    const anchorMatchIdx = entries.findIndex((entry) => anchor && entry.start <= anchor && anchor <= entry.end);
    const anchorIdx = anchorMatchIdx >= 0 ? anchorMatchIdx : 0;
    const ordered = anchorIdx >= 0 ? [...entries.slice(anchorIdx), ...entries.slice(0, anchorIdx)] : entries;
    const needed = 12;
    const limited = ordered.slice(0, needed);
    if (!limited.length) return null;
    while (limited.length < needed && ordered.length) {
      limited.push(ordered[limited.length % ordered.length]);
    }
    const span = 360 / Math.max(1, limited.length);
    const startAngle = -90 - span / 2;
    const segments = limited
      .map((entry, idx) => {
        const startDeg = startAngle + idx * span;
        const endDeg = startDeg + span;
        const signMeta = { name: signName(entry.sign), icon: signSymbol(entry.sign) };
        return {
          ...entry,
          idx,
          startDeg,
          endDeg,
          span,
          midDeg: startDeg + span / 2,
          decan1: startDeg + span / 3,
          decan2: startDeg + (2 * span) / 3,
          signMeta,
        };
      })
      .filter(Boolean);
    if (!segments.length) return null;

    const rangeKey = normalizeRangeId(range.id || range.label || `layer-${layerIndex}`) || `layer-${layerIndex}`;
    const accent = layerIndex === 0 ? '#22d3ee' : '#c084fc';
    const isInner = layerCount > 1 && layerIndex === 1;
    const innerScale = isInner ? 0.85 : 1;
    const baseRadius = layerCount > 1 ? (isInner ? 118 : 230) : 224;
    const elementRadius = baseRadius - (isInner ? 70 : 86);
    const radii = {
      segmentOuter: baseRadius,
      segmentInner: baseRadius - (isInner ? 32 : 24),
      text: baseRadius - 14,
      date: baseRadius + 14,
      planet: baseRadius - (isInner ? 52 : 40),
      quality: baseRadius - (isInner ? 58 : 64),
      element: elementRadius,
      polarity: elementRadius,
    };
    const outlines = renderDiscOutlines(radii, cx, cy);
    const signLookup = segments.reduce((acc, seg) => {
      const abbrev = (seg.sign || '').slice(0, 3).toLowerCase();
      const full = (seg.signMeta?.name || '').toLowerCase();
      if (seg.sign) acc[seg.sign] = seg;
      if (abbrev) acc[abbrev] = seg;
      if (full) acc[full] = seg;
      return acc;
    }, {});

    const currentSeg = segments[0];
    const rangePoints = pointsByRangeId[rangeKey] || pointsByRangeId.default || {};
    const sunPoint = pickPoint(rangePoints, 'sun') || {};
    const sunElement = sunPoint.element || currentSeg?.element || 'Fire';
    const sunQuality = sunPoint.quality || currentSeg?.quality || 'Cardinal';
    const sunPolarity = resolvePolarity(sunElement);
    const centerSignMeta = { name: signName(sunPoint.sign || currentSeg?.sign), icon: signSymbol(sunPoint.sign || currentSeg?.sign) };

    const signDisc = buildSignDisc(segments, radii, cx, cy, accent, anchorYear, defs, rangeKey, isInner);
    const elementQualityDisc = layerCount > 1 && isInner ? [] : buildElementQualityDisc(segments, radii, cx, cy);
    const polarityDisc = buildPolarityDisc(segments, radii, cx, cy);
    const planetDisc = buildPlanetDisc({
      cx,
      cy,
      radii,
      rangeKey,
      pointsByRangeId,
      signLookup,
      currentSeg,
      anchor,
      sunPolarity,
      centerSignMeta,
      defs,
    });
    const sunLabel = centerSignMeta?.name || signName(currentSeg?.sign) || 'Sun';
    const anchorLabel = formatDateTimeShort(anchor);
    const qualityIcon = QUALITY_ICON[sunQuality] || '';
    const titleColor = adjustHex(accent, 0.05);
    const orbCandidate =
      typeof currentSeg?.position === 'number'
        ? currentSeg.position
        : typeof sunPoint?.position === 'number'
          ? sunPoint.position
          : typeof sunPoint?.abs_pos === 'number'
            ? ((sunPoint.abs_pos % 30) + 30) % 30
            : null;
    const orbText = Number.isFinite(orbCandidate) ? `${orbCandidate.toFixed(2)}°` : '—';
    const centerChip = {
      title: `${range.label || range.id || 'Sky layer'} · ${anchorLabel}`,
      titleColor,
      main: `${POINT_SYMBOLS.sun || '☉'} ${sunLabel} ${centerSignMeta?.icon || ''} · ${orbText}`,
      meta: `${ELEMENT_ICON[sunElement] || ''} ${sunElement || '—'} · ${qualityIcon} · ${sunPolarity.symbol} ${sunPolarity.label}`,
    };

    const legendLabel = range.label || range.id || 'Layer';

    return {
      svg: '',
      centerChip,
      legendLabel,
      firstSignNum: pickFirstSignNum(range) ?? segments[0]?.sign_num ?? segments[0]?.signNum ?? null,
      elementSigil: {
        icon: ELEMENT_ICON[sunElement] || '',
        label: sunElement || '',
      },
      summarySigil: buildSigilBase(rangePoints, anchor),
      accent,
      signDisc,
      elementQualityDisc,
      polarityDisc,
      planetDisc,
      outlines,
      cx,
      cy,
      innerScale,
      rotationOffset,
    };
  }

  const emptySky = {
    layers: [],
    defs: [],
    accent: '#38bdf8',
    legends: [],
    centerChips: [],
    size: 540,
    layerCount: 0,
    cx: 270,
    cy: 270,
  };

  function buildSkyMap(sunRanges, pointsByRangeId) {
    const ranges = pickSkyRanges(sunRanges);
    if (!ranges.length) return emptySky;
    const layerCount = Math.min(2, ranges.length);
    const size = layerCount > 1 ? 560 : 540;
    const cx = size / 2;
    const cy = size / 2;
    const defs = [
      {
        type: 'linearGradient',
        id: `sky-shadow-${uid}`,
        x1: '0',
        y1: '0',
        x2: '0',
        y2: '1',
        stops: [
          { offset: '0%', color: '#0b172a', opacity: 0 },
          { offset: '55%', color: '#0b172a', opacity: 0.12 },
          { offset: '100%', color: '#050b18', opacity: 0.35 },
        ],
      },
    ];
    const layers = [];
    const chips = [];
    const legends = [];
    const accents = [];

    let baseSignNum = null;
    ranges.forEach((range, idx) => {
      const targetSign = pickFirstSignNum(range);
      const rotationOffset =
        idx === 0 || baseSignNum === null || targetSign === null
          ? 0
          : ((((targetSign - baseSignNum) % 12) + 12) % 12) * 30;
      const layer = buildSkyMapLayer(range, {
        cx,
        cy,
        layerIndex: idx,
        layerCount,
        defs,
        pointsByRangeId,
        rotationOffset,
      });
      if (layer) {
        layers.push(layer);
        chips.push(layer.centerChip);
        legends.push(layer.legendLabel);
        accents.push(layer.accent || '#38bdf8');
        if (idx === 0 && layer.firstSignNum != null) {
          baseSignNum = layer.firstSignNum;
        }
      }
    });

    if (!layers.length) return emptySky;

    return {
      layers,
      defs,
      accent: accents[0] || '#38bdf8',
      legends,
      centerChips: chips,
      size,
      layerCount,
      cx,
      cy,
    };
  }

  $: normalizedRanges = pickSkyRanges((ranges || []).map(normalizeSunRange).filter(Boolean));
  $: sky = buildSkyMap(normalizedRanges, pointsByRangeId || {});
  $: ({ layers, defs, accent, legends, centerChips, size, layerCount, cx, cy } = sky || emptySky);
</script>

{#if layers.length}
  <div class="adv-sky-wrap" style={`--sky-pill:${accent}`}>
    {#if legends.length}
      <div class="adv-sky-legend">
        {#each legends as legend}
          <span class="adv-sky-pill">{legend}</span>
        {/each}
      </div>
    {/if}

    <div class="adv-sky-stage">
      <svg viewBox={`0 0 ${size} ${size}`} class="adv-sky-svg" role="img" aria-label="Circular sky map">
        <defs>
          {#each defs as def}
            {#if def.type === 'linearGradient'}
              <linearGradient id={def.id} x1={def.x1} y1={def.y1} x2={def.x2} y2={def.y2}>
                {#each def.stops || [] as stop}
                  <stop offset={stop.offset} stop-color={stop.color} stop-opacity={stop.opacity} />
                {/each}
              </linearGradient>
            {:else if def.type === 'radialGradient'}
              <radialGradient id={def.id} cx={def.cx} cy={def.cy} r={def.r}>
                {#each def.stops || [] as stop}
                  <stop offset={stop.offset} stop-color={stop.color} stop-opacity={stop.opacity} />
                {/each}
              </radialGradient>
            {:else if def.type === 'path'}
              <path id={def.id} d={def.d} fill="none" />
            {/if}
          {/each}
        </defs>

        {#each layers as layer}
          <g
            class="adv-sky-layer"
            style={`--sky-accent:${layer.accent}`}
            transform={`translate(${layer.cx} ${layer.cy}) rotate(${90 + layer.rotationOffset}) scale(${layer.innerScale}) translate(${-layer.cx} ${-layer.cy})`}
          >
            {#each layer.signDisc.spans as span}
              <path d={span.d} fill="none" stroke={span.stroke} stroke-width={span.width} opacity="0.3" />
            {/each}

            {#each layer.signDisc.separators as sep}
              <line x1={sep.x1} y1={sep.y1} x2={sep.x2} y2={sep.y2} stroke="rgba(226,232,240,0.18)" stroke-width="0.7" />
            {/each}

            {#each layer.signDisc.decans as line}
              <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="rgba(226,232,240,0.28)" stroke-width="0.65" stroke-dasharray="2 8" />
            {/each}

            {#each layer.outlines as outline}
              <circle cx={layer.cx} cy={layer.cy} r={outline.r} fill="none" stroke={outline.stroke} stroke-width={outline.width} />
            {/each}

            {#each layer.signDisc.labels as label}
              <text class="adv-sky-constellation" style={label.style}>
                <textPath href={`#${label.pathId}`} startOffset="50%" text-anchor="middle">{label.text}</textPath>
              </text>
            {/each}

            {#each layer.signDisc.dates as date}
              <text class="adv-sky-date" style={`fill:${date.color}`}>
                <textPath href={`#${date.pathId}`} startOffset="2%" text-anchor="start">{date.text}</textPath>
              </text>
            {/each}

            {#if layer.elementQualityDisc.length}
              {#each layer.elementQualityDisc as entry}
                <text class="adv-sky-element" transform={entry.transform} text-anchor="middle" dominant-baseline="middle">
                  <title>{entry.title}</title>
                  {entry.content}
                </text>
              {/each}
            {/if}

            {#each layer.polarityDisc as entry}
              <text class="adv-sky-polarity" transform={entry.transform} text-anchor="middle" dominant-baseline="middle">
                <title>{entry.title}</title>
                {entry.symbol}
              </text>
            {/each}

            {#if layer.planetDisc.sun}
              <g class="adv-sky-sun" transform={`translate(${layer.planetDisc.sun.x} ${layer.planetDisc.sun.y}) rotate(-90)`}>
                <title>{layer.planetDisc.sun.title}</title>
                <circle r={layer.planetDisc.sun.r1} fill={`url(#${layer.planetDisc.sun.gradientId})`} opacity="0.92" />
                <circle
                  r={layer.planetDisc.sun.r2}
                  fill={`url(#${layer.planetDisc.sun.gradientId})`}
                  stroke="rgba(255,255,255,0.65)"
                  stroke-width="1.2"
                />
                <text class="adv-sky-point-icon" text-anchor="middle" dominant-baseline="middle">{layer.planetDisc.sun.icon}</text>
              </g>
            {/if}

            {#each layer.planetDisc.points as pt}
              <g class="adv-sky-point" transform={`translate(${pt.x} ${pt.y}) rotate(-90)`}>
                <title>{pt.title}</title>
                {#if pt.ring === 'saturn'}
                  <ellipse rx={pt.size * 1.3} ry={pt.size * 0.4} fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.1" />
                {:else if pt.ring === 'uranus'}
                  <ellipse rx={pt.size * 0.2} ry={pt.size * 1.3} fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.1" />
                {/if}

                {#if pt.shape === 'triangle'}
                  <path
                    d={`M 0 ${-pt.size} L ${pt.size * 0.92} ${pt.size * 0.8} L ${-pt.size * 0.92} ${pt.size * 0.8} Z`}
                    fill={`url(#${pt.gradientId})`}
                    stroke="rgba(255,255,255,0.32)"
                    stroke-width="1"
                  />
                {:else}
                  <circle r={pt.size} fill={`url(#${pt.gradientId})`} stroke="rgba(255,255,255,0.35)" stroke-width="1.1" />
                {/if}
                <text class="adv-sky-point-icon" text-anchor="middle" dominant-baseline="middle" style={`font-size:${pt.size <= PLANET_SIZE.sm ? '0.7rem' : pt.size <= PLANET_SIZE.md ? '0.8rem' : '0.95rem'}`}>
                  {pt.icon}
                </text>
              </g>
            {/each}
          </g>
        {/each}

        <rect x="0" y={cy} width={size} height={cy} fill={`url(#sky-shadow-${uid})`} pointer-events="none" />
      </svg>

      <div class={layerCount > 1 ? 'adv-sky-center adv-sky-center-dual' : 'adv-sky-center'}>
        {#if layerCount > 1}
          {#each centerChips as chip, idx}
            <div class={`adv-sky-chip-slot ${idx === 0 ? 'adv-sky-chip-left' : 'adv-sky-chip-right'}`}>
              {#if chip}
                <div class="adv-sky-chip">
                  <div class="adv-sky-chip-title" style={`color:${chip.titleColor}`}>{chip.title}</div>
                  <div class="adv-sky-chip-main">{chip.main}</div>
                  <div class="adv-sky-chip-meta">{chip.meta}</div>
                </div>
              {/if}
            </div>
          {/each}
        {:else if centerChips[0]}
          <div class="adv-sky-chip">
            <div class="adv-sky-chip-title" style={`color:${centerChips[0].titleColor}`}>{centerChips[0].title}</div>
            <div class="adv-sky-chip-main">{centerChips[0].main}</div>
            <div class="adv-sky-chip-meta">{centerChips[0].meta}</div>
          </div>
        {/if}
      </div>

      {#if layers[0] && layers[0].elementSigil?.icon}
        <div
          class="adv-sky-element-badge"
          aria-label={`Element ${layers[0].elementSigil.label}`}
          title={`Element ${layers[0].elementSigil.label}`}
          style={`--badge-accent:${layers[0].accent || accent};`}
        >
          {layers[0].elementSigil.icon}
        </div>
      {/if}

      {#if layerCount > 1 && layers[1] && layers[1].elementSigil?.icon}
        <div
          class="adv-sky-element-badge adv-sky-element-badge-right"
          aria-label={`Element ${layers[1].elementSigil.label}`}
          title={`Element ${layers[1].elementSigil.label}`}
          style={`--badge-accent:${layers[1].accent || accent};`}
        >
          {layers[1].elementSigil.icon}
        </div>
      {/if}

      {#if layerCount === 1 && layers[0]?.summarySigil}
        <div class="adv-sky-summary-badge" aria-label="Chart summary sigil" title="Chart summary sigil">
          <ElementSigil
            size={78}
            compact={true}
            sunElement={layers[0].summarySigil.sunElement}
            moonElement={layers[0].summarySigil.moonElement}
            dayElement={layers[0].summarySigil.dayElement}
            ascElement={layers[0].summarySigil.ascElement}
            dayRulerKey={layers[0].summarySigil.dayRulerKey}
          />
        </div>
      {/if}
    </div>
  </div>
{:else}
  <p class="text-sm text-slate-400">Generate a chart to see point and house placements.</p>
{/if}

<style>
  .adv-sky-wrap {
    --sky-pill: #38bdf8;
    display: inline-flex;
    flex-direction: column;
    gap: 0.65rem;
    width: 100%;
  }

  .adv-sky-legend {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .adv-sky-pill {
    --sky-pill: #38bdf8;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.8rem;
    border-radius: 999px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--sky-pill) 35%, transparent), rgba(15, 23, 42, 0.4));
    border: 1px solid color-mix(in srgb, var(--sky-pill) 45%, rgba(255, 255, 255, 0.08));
    color: #e2f3ff;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .adv-sky-stage {
    position: relative;
    border-radius: 1.25rem;
    border: 1px solid rgba(56, 189, 248, 0.25);
    background: radial-gradient(circle at 40% 40%, rgba(59, 130, 246, 0.12), rgba(2, 6, 23, 0.35)),
      radial-gradient(circle at 70% 70%, rgba(14, 165, 233, 0.12), rgba(2, 6, 23, 0.15)),
      linear-gradient(145deg, rgba(7, 11, 22, 0.9), rgba(7, 12, 26, 0.95));
    padding: 0.85rem;
    box-shadow: 0 20px 50px rgba(8, 47, 73, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.03);
    overflow: hidden;
  }

  .adv-sky-svg {
    width: 100%;
    height: auto;
    display: block;
    filter: drop-shadow(0 14px 36px rgba(8, 47, 73, 0.4));
  }

  .adv-sky-svg text {
    font-family: 'Inter', 'Space Grotesk', 'Sora', system-ui, -apple-system, sans-serif;
  }

  .adv-sky-center {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
  }

  .adv-sky-center-dual {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
  }

  .adv-sky-chip-slot {
    display: flex;
    justify-content: center;
    width: 50%;
    pointer-events: none;
  }

  .adv-sky-element-badge {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, color-mix(in srgb, var(--badge-accent, #38bdf8) 35%, transparent), rgba(8, 47, 73, 0.5));
    border: 1px solid color-mix(in srgb, var(--badge-accent, #38bdf8) 45%, rgba(255, 255, 255, 0.3));
    color: #e2f3ff;
    font-size: 1.1rem;
    box-shadow: 0 10px 24px rgba(8, 47, 73, 0.35);
  }

  .adv-sky-element-badge-right {
    left: auto;
    right: 0.75rem;
  }

  .adv-sky-summary-badge {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    width: 82px;
    height: 82px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.75), rgba(8, 13, 26, 0.92));
    border: 1px solid rgba(148, 163, 184, 0.35);
    box-shadow: 0 14px 30px rgba(8, 47, 73, 0.4);
    overflow: hidden;
  }

  .adv-sky-chip {
    pointer-events: auto;
    padding: 0.7rem 0.9rem;
    border-radius: 0.95rem;
    border: 1px solid rgba(125, 211, 252, 0.32);
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(8, 13, 26, 0.92));
    box-shadow: 0 12px 34px rgba(4, 7, 16, 0.55), 0 0 0 1px rgba(148, 163, 184, 0.08);
    max-width: 360px;
    text-align: center;
  }

  .adv-sky-chip-title {
    margin: 0;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #7dd3fc;
  }

  .adv-sky-chip-main {
    margin: 0.15rem 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: #e2f3ff;
  }

  .adv-sky-chip-meta {
    margin: 0;
    font-size: 0.9rem;
    color: #cbd5e1;
  }

  .adv-sky-constellation {
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    fill: #e0f2fe;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  }

  .adv-sky-date {
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    fill: rgba(148, 163, 184, 0.9);
  }

  .adv-sky-element {
    font-size: 0.82rem;
    fill: #bfdbfe;
    letter-spacing: 0.04em;
  }

  .adv-sky-polarity {
    font-size: 0.74rem;
    fill: #fcd34d;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .adv-sky-point-icon {
    font-size: 0.82rem;
    font-weight: 700;
    fill: #0b172a;
  }
</style>
