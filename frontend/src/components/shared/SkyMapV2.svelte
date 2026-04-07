<script>
  /**
   * SkyMapV2 - Counter-clockwise zodiac wheel with unified single-ring architecture
   * 
   * Orientation: ASC at 9 o'clock (270°), counter-clockwise
   * Single ring: Works for single and dual modes
   * Planets: Primary at outer track, secondary at inner track with aura
   */
  import {
    normalizeAngle,
    polarToCartesian,
    describeArc,
    describeArcCCW,
    longitudeToChartAngle,
    angularDistance,
    normalizePointKey,
  } from '$lib/utils/geometry';
  import {
    ELEMENT_HEX,
    ELEMENT_ICON,
    POINT_SYMBOLS,
    QUALITY_ICON,
    signElement,
    SIGNS,
    POLARITY_BY_ELEMENT,
    HOUSE_MEANINGS,
  } from '$lib/astro/signs';
  import { configStore } from '$lib/state/configStore';

  // Props
  export let points = {};
  export let houses = {};
  export let natalPoints = {};
  export let natalHouses = {};
  export let mode = 'natal';
  export let useNatalFramework = false;
  export let anchorDate = null;
  export let sunRanges = [];
  export let primarySubjectName = 'Subject 1';
  export let secondarySubjectName = 'Subject 2';
  // Summary chip data: { title, main, meta, titleColor }
  export let primaryChip = null;
  export let secondaryChip = null;

  // Constants - viewBox 680 for more space
  const SIZE = 680;
  const CX = SIZE / 2;
  const CY = SIZE / 2;

  // Radii structure (from outer to inner) - scaled for 680 viewBox, no gaps
  // All rings are continuous from zodiac to inner disc
  const RADII = {
    outer: 320,
    zodiacOuter: 300,
    zodiacInner: 265,
    // Planets ring - continuous from zodiac inner
    planetsRingOuter: 265,
    planetsRingInner: 235,
    planetTrackPrimary: 254,
    planetTrackSecondary: 246,
    // Houses ring - continuous from planets inner
    houseOuter: 235,
    houseInner: 210,
    // Element ring - continuous from houses inner
    elementRingOuter: 210,
    elementRingInner: 186,
    elementLabelRadius: 198,
    // Quality ring - continuous from element inner
    qualityRingOuter: 186,
    qualityRingInner: 164,
    qualityLabelRadius: 175,
    // Polarity - continuous from quality inner
    polarityRingOuter: 164,
    polarityRingInner: 142,
    polarityLabelRadius: 153,
    aspectCircle: 130,
    center: 0,
  };

  // Planet colors
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
    chiron: '#87ceeb',
    mean_lilith: '#4a0080',
    true_north_lunar_node: '#8b5cf6',
    true_south_lunar_node: '#d946ef',
    ascendant: '#a855f7',
    descendant: '#f472b6',
    medium_coeli: '#f59e0b',
    imum_coeli: '#84cc16',
  };

  // Planet sizes
  const PLANET_SIZES = {
    sun: 14,
    moon: 11,
    mercury: 9,
    venus: 10,
    mars: 11,
    jupiter: 12,
    saturn: 11,
    uranus: 10,
    neptune: 10,
    pluto: 9,
    chiron: 8,
    mean_lilith: 8,
    true_north_lunar_node: 8,
    true_south_lunar_node: 8,
    ascendant: 10,
    descendant: 9,
    medium_coeli: 9,
    imum_coeli: 9,
    default: 9,
  };

  const POINT_KEY_ALIAS = {
    asc: 'ascendant',
    dsc: 'descendant',
    mc: 'medium_coeli',
    ic: 'imum_coeli',
  };

  // Unique ID for this instance
  const uid = `skyv2-${Math.random().toString(36).slice(2, 8)}`;

  // Utility functions
  const hexToRgba = (hex, alpha = 1) => {
    const match = hex.replace('#', '').match(/.{1,2}/g);
    if (!match || match.length < 3) return `rgba(100,100,100,${alpha})`;
    const [r, g, b] = match.map(c => parseInt(c, 16));
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const adjustHex = (hex, amount) => {
    const match = hex.replace('#', '').match(/.{1,2}/g);
    if (!match || match.length < 3) return hex;
    const [r, g, b] = match.map(c => parseInt(c, 16));
    const adjust = (c) => Math.max(0, Math.min(255, c + Math.round(amount * 255)));
    return `#${[adjust(r), adjust(g), adjust(b)].map(c => c.toString(16).padStart(2, '0')).join('')}`;
  };

  const canonicalPointKey = (key) => POINT_KEY_ALIAS[normalizePointKey(key)] || normalizePointKey(key);
  const getPlanetGlyph = (key) => POINT_SYMBOLS[canonicalPointKey(key)] || '★';
  const getPlanetSize = (key) => PLANET_SIZES[canonicalPointKey(key)] || PLANET_SIZES.default;
  const getPlanetColor = (key) => PLANET_COLORS[canonicalPointKey(key)] || '#67e8f9';

  // Mode flags
  $: isDualMode = mode === 'relationship' || mode === 'natal_transit';
  $: isRelationshipMode = mode === 'relationship';
  $: isTransitMode = mode === 'natal_transit';
  let viewportWidth = 1280;
  $: isDesktop = viewportWidth >= 1024;
  $: basePlanetsRingWidth = RADII.planetsRingOuter - RADII.planetsRingInner;
  $: targetPlanetsRingWidth = (() => {
    if (isDesktop) return isDualMode ? 108 : 62;
    if (isDualMode) return 78;
    return basePlanetsRingWidth;
  })();
  $: ringsShift = Math.max(0, targetPlanetsRingWidth - basePlanetsRingWidth);
  $: activePlanetsRingOuter = RADII.planetsRingOuter;
  $: activePlanetsRingInner = RADII.planetsRingInner - ringsShift;
  $: activeHouseOuter = RADII.houseOuter - ringsShift;
  $: activeHouseInner = RADII.houseInner - ringsShift;
  $: activeElementRingOuter = RADII.elementRingOuter - ringsShift;
  $: activeElementRingInner = RADII.elementRingInner - ringsShift;
  $: activeElementLabelRadius = RADII.elementLabelRadius - ringsShift;
  $: activeQualityRingOuter = RADII.qualityRingOuter - ringsShift;
  $: activeQualityRingInner = RADII.qualityRingInner - ringsShift;
  $: activeQualityLabelRadius = RADII.qualityLabelRadius - ringsShift;
  $: activePolarityRingOuter = RADII.polarityRingOuter - ringsShift;
  $: activePolarityRingInner = RADII.polarityRingInner - ringsShift;
  $: activePolarityLabelRadius = RADII.polarityLabelRadius - ringsShift;
  $: activeAspectCircle = Math.max(72, RADII.aspectCircle - ringsShift);
  $: activePrimaryTrack = isDualMode ? activePlanetsRingOuter - 12 : activePlanetsRingOuter - 15;
  $: activeSecondaryTrack = isDualMode ? activePlanetsRingInner + 12 : RADII.planetTrackSecondary;
  $: planetTracksSeparatorRadius = (activePrimaryTrack + activeSecondaryTrack) / 2;

  // Active points from config
  $: activeSet = new Set(($configStore.active_points || []).map(normalizePointKey));

  // Determine which houses and points to use as active framework
  $: activeHouses = isTransitMode
    ? natalHouses
    : (isRelationshipMode && useNatalFramework ? natalHouses : houses);

  $: primaryPoints = isTransitMode
    ? natalPoints
    : (isRelationshipMode && useNatalFramework ? natalPoints : points);
  $: secondaryPoints = isDualMode
    ? (isTransitMode ? points : (isRelationshipMode && useNatalFramework ? points : natalPoints))
    : {};

  // Filter points by active configuration
  const filterPointsByActive = (pts, activeKeys) => {
    if (!pts || !activeKeys.size) return pts;
    return Object.fromEntries(
      Object.entries(pts).filter(([key]) => activeKeys.has(normalizePointKey(key)) || canonicalPointKey(key) === 'ascendant')
    );
  };

  const findPointByKeys = (pts, keys = []) => {
    const targetSet = new Set((keys || []).map(canonicalPointKey));
    return Object.entries(pts || {}).find(([key]) => targetSet.has(canonicalPointKey(key)))?.[1] || null;
  };

  const findPointLongitude = (pts, keys = []) => {
    const point = findPointByKeys(pts, keys);
    const lon = point?.abs_pos ?? point?.position ?? null;
    return Number.isFinite(lon) ? normalizeAngle(lon) : null;
  };

  $: filteredPrimaryPoints = filterPointsByActive(primaryPoints, activeSet);
  $: filteredSecondaryPoints = isDualMode ? filterPointsByActive(secondaryPoints, activeSet) : {};

  const HOUSE_NUM_WORDS = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
    seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12
  };

  const houseNumFromKey = (key) => {
    const text = String(key || '').toLowerCase();
    const numMatch = text.match(/(\d+)/);
    if (numMatch) {
      const n = Number(numMatch[1]);
      if (n >= 1 && n <= 12) return n;
    }
    for (const [word, num] of Object.entries(HOUSE_NUM_WORDS)) {
      if (text.includes(word)) return num;
    }
    return null;
  };

  const findHouseByNumber = (housesObj, houseNum) =>
    Object.entries(housesObj || {}).find(([key]) => houseNumFromKey(key) === houseNum)?.[1] || null;

  const getAscLongitudeFromFramework = (housesObj, frameworkPoints) => {
    const ascFromPoints = findPointLongitude(frameworkPoints, ['ascendant', 'asc']);
    if (Number.isFinite(ascFromPoints)) return ascFromPoints;
    const house1 = findHouseByNumber(housesObj, 1);
    const lon = house1?.abs_pos ?? house1?.position ?? null;
    return Number.isFinite(lon) ? normalizeAngle(lon) : 0;
  };

  $: ascLongitude = getAscLongitudeFromFramework(activeHouses, primaryPoints);

  $: ascPointLongitude = findPointLongitude(primaryPoints, ['ascendant', 'asc']);
  $: dscPointLongitude = (() => {
    const explicit = findPointLongitude(primaryPoints, ['descendant', 'dsc']);
    if (Number.isFinite(explicit)) return explicit;
    if (Number.isFinite(ascPointLongitude)) return normalizeAngle(ascPointLongitude + 180);
    return null;
  })();
  $: mcPointLongitude = findPointLongitude(primaryPoints, ['medium_coeli', 'mc']);
  $: icPointLongitude = (() => {
    const explicit = findPointLongitude(primaryPoints, ['imum_coeli', 'ic']);
    if (Number.isFinite(explicit)) return explicit;
    if (Number.isFinite(mcPointLongitude)) return normalizeAngle(mcPointLongitude + 180);
    return null;
  })();

  // ==================== ZODIAC SEGMENTS ====================
  $: zodiacSegments = (() => {
    return SIGNS.map((sign, idx) => {
      const signStartLon = idx * 30;
      const signEndLon = (idx + 1) * 30;
      const startDeg = longitudeToChartAngle(signStartLon, ascLongitude);
      const endDeg = longitudeToChartAngle(signEndLon, ascLongitude);
      const midDeg = longitudeToChartAngle(signStartLon + 15, ascLongitude);
      
      return {
        ...sign,
        idx,
        startDeg,
        endDeg,
        midDeg,
        color: ELEMENT_HEX[sign.element] || ELEMENT_HEX.Default,
        polarity: POLARITY_BY_ELEMENT[sign.element],
        qualityIcon: QUALITY_ICON[sign.quality] || '',
      };
    });
  })();

  // ==================== HOUSE CUSPS ====================
  const buildHouseCusps = (housesObj, ascLon) => {
    if (!housesObj || !Object.keys(housesObj).length) return [];
    const houseEntries = Object.entries(housesObj)
      .map(([key, house]) => {
        const num = houseNumFromKey(key);
        return { key, house, num };
      })
      .filter((e) => e.num && e.num >= 1 && e.num <= 12)
      .sort((a, b) => a.num - b.num);

    return houseEntries.map(({ house, num }) => {
      const lon = house?.abs_pos ?? house?.position ?? 0;
      const angle = longitudeToChartAngle(lon, ascLon);
      const sign = house?.sign || '';
      const element = house?.element || signElement(sign) || 'Default';
      const color = ELEMENT_HEX[element] || ELEMENT_HEX.Default;
      return { num, angle, lon, sign, element, color };
    });
  };

  $: houseCusps = buildHouseCusps(activeHouses, ascLongitude);

  // Build house segments (area between consecutive cusps)
  $: houseSegments = (() => {
    if (houseCusps.length < 12) return [];
    return houseCusps.map((cusp, idx) => {
      const nextIdx = (idx + 1) % 12;
      const nextCusp = houseCusps[nextIdx];
      const startAngle = cusp.angle;
      const endAngle = nextCusp.angle;
      // Midpoint for label
      let midAngle = (startAngle + endAngle) / 2;
      if (Math.abs(endAngle - startAngle) > 180) {
        midAngle = normalizeAngle(midAngle + 180);
      }
      return {
        num: cusp.num,
        startAngle,
        endAngle,
        midAngle,
        color: cusp.color,
        sign: cusp.sign,
      };
    });
  })();

  // Axis labels (ASC, DSC, MC, IC)
  $: axisLabels = (() => {
    const labels = [];
    if (Number.isFinite(ascPointLongitude)) {
      labels.push({ label: 'ASC', angle: longitudeToChartAngle(ascPointLongitude, ascLongitude), color: PLANET_COLORS.ascendant });
    }
    if (Number.isFinite(dscPointLongitude)) {
      labels.push({ label: 'DSC', angle: longitudeToChartAngle(dscPointLongitude, ascLongitude), color: PLANET_COLORS.descendant });
    }
    if (Number.isFinite(mcPointLongitude)) {
      labels.push({ label: 'MC', angle: longitudeToChartAngle(mcPointLongitude, ascLongitude), color: PLANET_COLORS.medium_coeli });
    }
    if (Number.isFinite(icPointLongitude)) {
      labels.push({ label: 'IC', angle: longitudeToChartAngle(icPointLongitude, ascLongitude), color: PLANET_COLORS.imum_coeli });
    }
    return labels;
  })();

  // ==================== PLANETS ====================
  const buildPlanetPositions = (pts, ascLon, baseRadius, owner = 'primary') => {
    return Object.entries(pts || {})
      .filter(([, p]) => p && typeof p === 'object')
      .map(([key, point]) => {
        const lon = point?.abs_pos ?? point?.position ?? null;
        if (!Number.isFinite(lon)) return null;
        const normKey = canonicalPointKey(key);
        // Keep ASC visible as marker, skip only the other axis points
        if (['descendant', 'medium_coeli', 'imum_coeli', 'mc', 'ic', 'dsc'].includes(normKey)) {
          return null;
        }
        const angle = longitudeToChartAngle(lon, ascLon);
        const size = getPlanetSize(key);
        const color = getPlanetColor(key);
        return {
          key: normKey,
          name: point.name || key,
          angle,
          radius: baseRadius,
          size,
          sign: point.sign || '',
          position: point.position ?? (lon % 30),
          lon,
          glyph: getPlanetGlyph(key),
          color,
          owner,
          shape: normKey === 'ascendant' ? 'triangle' : 'circle',
        };
      })
      .filter(Boolean);
  };

  // Collision resolution
  const resolvePlanetCollisions = (planetList, trackRadius) => {
    const sorted = [...planetList].sort((a, b) => b.size - a.size);
    const placed = [];

    sorted.forEach((planet) => {
      let { angle, radius, size } = planet;
      const conflict = placed.find(
        (p) => angularDistance(p.angle, angle) < 9 && Math.abs(p.radius - radius) < size * 1.5
      );
      if (conflict) {
        // Shift radius inward/outward
        radius = radius > trackRadius ? radius - size * 0.8 : radius + size * 0.8;
      }
      placed.push({ ...planet, radius });
    });
    return placed;
  };

  const resolveCrossTrackCollisions = (primaryList, secondaryList, minRadius = activeHouseOuter + 4) => {
    const occupied = primaryList.map((p) => ({ angle: p.angle, radius: p.radius, size: p.size }));
    return secondaryList.map((planet) => {
      let radius = planet.radius;
      let attempts = 0;
      while (
        occupied.some((p) => angularDistance(p.angle, planet.angle) < 9 && Math.abs(p.radius - radius) < Math.max(p.size, planet.size) * 1.35) &&
        attempts < 4
      ) {
        radius -= Math.max(2, planet.size * 0.5);
        attempts += 1;
      }
      return { ...planet, radius: Math.max(minRadius, radius) };
    });
  };

  $: basePrimaryPlanets = resolvePlanetCollisions(
    buildPlanetPositions(filteredPrimaryPoints, ascLongitude, activePrimaryTrack, 'primary'),
    activePrimaryTrack
  );
  $: baseSecondaryPlanets = isDualMode
    ? resolvePlanetCollisions(
      buildPlanetPositions(filteredSecondaryPoints, ascLongitude, activeSecondaryTrack, 'secondary'),
      activeSecondaryTrack
    )
    : [];

  $: primaryPlanets = basePrimaryPlanets;
  $: secondaryPlanets = isDualMode
    ? resolveCrossTrackCollisions(primaryPlanets, baseSecondaryPlanets, activePlanetsRingInner + 4)
    : [];

  // Convert to SVG coordinates
  const planetToSvg = (planet) => {
    const coords = polarToCartesian(CX, CY, planet.radius, planet.angle);
    return { ...planet, x: coords.x, y: coords.y };
  };

  $: primaryPlanetsSvg = primaryPlanets.map(planetToSvg);
  $: secondaryPlanetsSvg = secondaryPlanets.map(planetToSvg);

  // ==================== SVG DEFS ====================
  $: svgDefs = (() => {
    const defs = [];
    
    // Glow filter for aura
    defs.push({
      type: 'filter',
      id: `${uid}-glow`,
      content: `
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      `,
    });

    // Planet gradients
    [...primaryPlanetsSvg, ...secondaryPlanetsSvg].forEach((planet) => {
      const baseColor = planet.color;
      defs.push({
        type: 'radialGradient',
        id: `${uid}-grad-${planet.key}-${planet.owner}`,
        cx: '40%',
        cy: '35%',
        r: '65%',
        stops: [
          { offset: '0%', color: adjustHex(baseColor, 0.35), opacity: 1 },
          { offset: '60%', color: baseColor, opacity: 0.95 },
          { offset: '100%', color: adjustHex(baseColor, -0.2), opacity: 0.85 },
        ],
      });
    });

    // Arc paths for text labels (CW direction so text reads correctly)
    zodiacSegments.forEach((seg, idx) => {
      const textRadius = (RADII.zodiacOuter + RADII.zodiacInner) / 2;
      // For text to read correctly, we need CW arc (swap start/end and use regular arc)
      defs.push({
        type: 'path',
        id: `${uid}-sign-path-${idx}`,
        d: describeArc(CX, CY, textRadius, seg.endDeg, seg.startDeg),
      });
    });

    return defs;
  })();

  const SIGN_ORDER = SIGNS.map((s) => s.key);

  const safeDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const d = value ? new Date(value) : null;
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  };

  const signIndexFromValue = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return null;
    const short = raw.slice(0, 3);
    const idx = SIGN_ORDER.indexOf(short);
    return idx >= 0 ? idx : null;
  };

  const normalizeRangeId = (value) => String(value || '').trim().toLowerCase();

  const normalizeSunRange = (range) => {
    if (!range || typeof range !== 'object') return null;
    const id = normalizeRangeId(range.id || range.label || '');
    const entries = (Array.isArray(range.entries) ? range.entries : [])
      .map((entry) => {
        const start = safeDate(entry?.start || entry?.timestamp || entry?.start_timestamp || entry?.startTimestamp);
        const signIndex = Number.isInteger(entry?.sign_num)
          ? entry.sign_num
          : Number.isInteger(entry?.signNum)
            ? entry.signNum
            : signIndexFromValue(entry?.sign);
        if (!start || !Number.isInteger(signIndex) || signIndex < 0 || signIndex > 11) return null;
        return { signIndex, start };
      })
      .filter(Boolean);
    if (!entries.length) return null;
    return {
      id,
      anchor: safeDate(range.anchor || range.anchor_timestamp || range.anchorTimestamp) || entries[0].start,
      entries,
    };
  };

  const formatSignDate = (date, anchorYear) => {
    const d = safeDate(date);
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const suffix = d.getFullYear() === anchorYear ? '' : `-${String(d.getFullYear()).slice(-2)}`;
    return `${day}-${month}${suffix}`;
  };

  const pickDateRangeId = (isTransit, isRelationship, useOtherFramework) => {
    if (isTransit) return 'natal';
    if (isRelationship) return useOtherFramework ? 'second' : 'first';
    return 'natal';
  };

  $: normalizedSunRanges = (sunRanges || []).map(normalizeSunRange).filter(Boolean);
  $: activeDateRange = (() => {
    const targetId = pickDateRangeId(isTransitMode, isRelationshipMode, useNatalFramework);
    const exact = normalizedSunRanges.find((range) => range.id === targetId);
    if (exact) return exact;
    const fallbackPriority = ['transit', 'first', 'second', 'natal'];
    return fallbackPriority.map((id) => normalizedSunRanges.find((range) => range.id === id)).find(Boolean) || normalizedSunRanges[0] || null;
  })();
  $: signDateLabels = (() => {
    const anchorYear = safeDate(activeDateRange?.anchor || anchorDate)?.getFullYear?.() || new Date().getFullYear();
    const bySign = {};
    (activeDateRange?.entries || []).forEach((entry) => {
      bySign[entry.signIndex] = formatSignDate(entry.start, anchorYear);
    });
    return bySign;
  })();

  // Format date for display
  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  $: activePrimaryOwnerName = (() => {
    if (isTransitMode) return secondarySubjectName || 'Natal';
    if (isRelationshipMode) return useNatalFramework ? (secondarySubjectName || 'Subject 2') : (primarySubjectName || 'Subject 1');
    return primarySubjectName || 'Chart';
  })();
  $: activeSecondaryOwnerName = (() => {
    if (!isDualMode) return '';
    if (isTransitMode) return `${primarySubjectName || 'Transit'} (Transit)`;
    if (isRelationshipMode) return useNatalFramework ? (primarySubjectName || 'Subject 1') : (secondarySubjectName || 'Subject 2');
    return secondarySubjectName || '';
  })();
  $: projectedAuraBaseColor = (() => {
    if (!isDualMode) return '#a855f7';
    if (isRelationshipMode) {
      // When framework switches, projected set is always the "other" subject.
      return useNatalFramework ? '#22d3ee' : '#c084fc';
    }
    // Transit projected set (transit subject accent)
    return '#22d3ee';
  })();
  $: projectedAuraStroke = hexToRgba(projectedAuraBaseColor, 0.85);
  $: primaryLabel = activePrimaryOwnerName;
  $: secondaryLabel = activeSecondaryOwnerName;
</script>

<svelte:window bind:innerWidth={viewportWidth} />

<div class="sky-map-v2" role="img" aria-label="Astrological chart wheel">
  <svg
    viewBox="0 0 {SIZE} {SIZE}"
    width="100%"
    height="100%"
    class="sky-map-svg"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      {#each svgDefs as def}
        {#if def.type === 'radialGradient'}
          <radialGradient id={def.id} cx={def.cx} cy={def.cy} r={def.r}>
            {#each def.stops || [] as stop}
              <stop offset={stop.offset} stop-color={stop.color} stop-opacity={stop.opacity} />
            {/each}
          </radialGradient>
        {:else if def.type === 'path'}
          <path id={def.id} d={def.d} fill="none" />
        {:else if def.type === 'filter'}
          <filter id={def.id}>
            {@html def.content}
          </filter>
        {/if}
      {/each}
    </defs>

    <!-- Background circles -->
    <circle cx={CX} cy={CY} r={RADII.outer} fill="rgba(15,23,42,0.8)" stroke="rgba(148,163,184,0.3)" stroke-width="1" />
    <circle cx={CX} cy={CY} r={RADII.zodiacInner} fill="none" stroke="rgba(148,163,184,0.2)" stroke-width="0.75" />
    <circle cx={CX} cy={CY} r={activeHouseOuter} fill="none" stroke="rgba(148,163,184,0.15)" stroke-width="0.5" />

    <!-- Zodiac ring segments with textPath for sign names -->
    <g id="{uid}-zodiac-ring">
      {#each zodiacSegments as seg, idx}
        {@const midRadius = (RADII.zodiacOuter + RADII.zodiacInner) / 2}
        {@const arcWidth = RADII.zodiacOuter - RADII.zodiacInner}
        <!-- Segment background (translucent) -->
        <path
          d={describeArcCCW(CX, CY, midRadius, seg.startDeg, seg.endDeg)}
          fill="none"
          stroke={hexToRgba(seg.color, 0.3)}
          stroke-width={arcWidth}
          class="zodiac-segment"
        >
          <title>{seg.name} · {seg.element} · {seg.quality}</title>
        </path>
        <!-- Sign name as textPath -->
        <text class="sign-text-path" fill={adjustHex(seg.color, 0.35)}>
          <textPath 
            href="#{uid}-sign-path-{idx}" 
            startOffset="50%" 
            text-anchor="middle"
          >
            {seg.name}
          </textPath>
        </text>
        <!-- Date label on outer edge aligned with sign start -->
        {@const dateLabelPos = polarToCartesian(CX, CY, RADII.outer + 10, seg.startDeg)}
        {@const dateRotation = seg.startDeg > 90 && seg.startDeg < 270 ? seg.startDeg + 180 : seg.startDeg}
        <text
          x={dateLabelPos.x}
          y={dateLabelPos.y}
          text-anchor="middle"
          dominant-baseline="central"
          class="sign-date-label"
          fill={hexToRgba(seg.color, 0.5)}
          transform="rotate({dateRotation}, {dateLabelPos.x}, {dateLabelPos.y})"
        >
          {signDateLabels[seg.idx] || ''}
        </text>
        <!-- Sign separator - extends from zodiac through planet track to houses -->
        {@const sepStart = polarToCartesian(CX, CY, activeHouseInner, seg.startDeg)}
        {@const sepEnd = polarToCartesian(CX, CY, RADII.zodiacOuter + 2, seg.startDeg)}
        <line
          x1={sepStart.x} y1={sepStart.y}
          x2={sepEnd.x} y2={sepEnd.y}
          stroke="rgba(226,232,240,0.2)"
          stroke-width="0.75"
        />
      {/each}
    </g>

    <!-- Planets ring background -->
    <g id="{uid}-planets-ring">
      {#each zodiacSegments as seg}
        {@const midRadius = (activePlanetsRingOuter + activePlanetsRingInner) / 2}
        {@const ringWidth = activePlanetsRingOuter - activePlanetsRingInner}
        <path
          d={describeArcCCW(CX, CY, midRadius, seg.startDeg, seg.endDeg)}
          fill="none"
          stroke={hexToRgba(seg.color, 0.05)}
          stroke-width={ringWidth}
        />
      {/each}
    </g>

    {#if isDualMode}
      <circle
        cx={CX}
        cy={CY}
        r={planetTracksSeparatorRadius}
        fill="none"
        stroke="rgba(148,163,184,0.28)"
        stroke-width="0.8"
        stroke-dasharray="3,3"
      />
    {/if}

    <!-- Primary planets (positioned in planets ring) -->
    <g id="{uid}-planets-primary">
      {#each primaryPlanetsSvg as planet}
        {@const hasSaturnRing = planet.key === 'saturn'}
        {@const hasUranusRing = planet.key === 'uranus'}
        <g class="planet-primary" transform="translate({planet.x}, {planet.y})">
          <title>{planet.name} ({activePrimaryOwnerName}) · {planet.sign} {planet.position?.toFixed(1)}°</title>
          <g class="planet-body">
            {#if hasSaturnRing}
              <ellipse
                rx={planet.size * 1.4}
                ry={planet.size * 0.35}
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                stroke-width="1"
              />
            {/if}
            {#if hasUranusRing}
              <ellipse
                rx={planet.size * 0.25}
                ry={planet.size * 1.3}
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                stroke-width="1"
              />
            {/if}
            {#if planet.shape === 'triangle'}
              <path
                d={`M 0 ${-planet.size} L ${planet.size * 0.92} ${planet.size * 0.8} L ${-planet.size * 0.92} ${planet.size * 0.8} Z`}
                fill="url(#{uid}-grad-{planet.key}-{planet.owner})"
                stroke="rgba(255,255,255,0.4)"
                stroke-width="1"
              />
            {:else}
              <circle
                r={planet.size}
                fill="url(#{uid}-grad-{planet.key}-{planet.owner})"
                stroke="rgba(255,255,255,0.4)"
                stroke-width="1"
              />
            {/if}
            <text
              x="0"
              y="0"
              text-anchor="middle"
              dominant-baseline="central"
              class="planet-glyph"
              font-size={planet.size <= 9 ? '0.6rem' : planet.size <= 11 ? '0.7rem' : '0.85rem'}
            >
              {planet.glyph}
            </text>
          </g>
        </g>
      {/each}
    </g>

    <!-- Secondary planets (with aura) -->
    {#if isDualMode}
      <g id="{uid}-planets-secondary">
        {#each secondaryPlanetsSvg as planet}
          {@const hasSaturnRing = planet.key === 'saturn'}
          {@const hasUranusRing = planet.key === 'uranus'}
          <g class="planet-secondary" transform="translate({planet.x}, {planet.y})">
            <title>{planet.name} ({activeSecondaryOwnerName}) · {planet.sign} {planet.position?.toFixed(1)}°</title>
            <g class="planet-body">
              <!-- Aura ring -->
              <circle
                r="20"
                fill="none"
                stroke={projectedAuraStroke}
                stroke-width="4"
                stroke-dasharray="1,1,1"
                filter="url(#{uid}-glow)"
              />
              {#if hasSaturnRing}
                <ellipse
                  rx={planet.size * 1.4}
                  ry={planet.size * 0.35}
                  fill="none"
                  stroke="rgba(255,255,255,0.5)"
                  stroke-width="1"
                />
              {/if}
              {#if hasUranusRing}
                <ellipse
                  rx={planet.size * 0.25}
                  ry={planet.size * 1.3}
                  fill="none"
                  stroke="rgba(255,255,255,0.5)"
                  stroke-width="1"
                />
              {/if}
              {#if planet.shape === 'triangle'}
                <path
                  d={`M 0 ${-planet.size} L ${planet.size * 0.92} ${planet.size * 0.8} L ${-planet.size * 0.92} ${planet.size * 0.8} Z`}
                  fill="url(#{uid}-grad-{planet.key}-{planet.owner})"
                  stroke="rgba(255,255,255,0.4)"
                  stroke-width="1"
                />
              {:else}
                <circle
                  r={planet.size}
                  fill="url(#{uid}-grad-{planet.key}-{planet.owner})"
                  stroke="rgba(255,255,255,0.4)"
                  stroke-width="1"
                />
              {/if}
              <text
                x="0"
                y="0"
                text-anchor="middle"
                dominant-baseline="central"
                class="planet-glyph"
                font-size={planet.size <= 9 ? '0.6rem' : planet.size <= 11 ? '0.7rem' : '0.85rem'}
              >
                {planet.glyph}
              </text>
            </g>
          </g>
        {/each}
      </g>
    {/if}

    <!-- House segments -->
    <g id="{uid}-houses">
      {#each houseSegments as house}
        {@const midRadius = (activeHouseOuter + activeHouseInner) / 2}
        {@const arcWidth = activeHouseOuter - activeHouseInner}
        <path
          d={describeArcCCW(CX, CY, midRadius, house.startAngle, house.endAngle)}
          fill="none"
          stroke={hexToRgba(house.color, 0.12)}
          stroke-width={arcWidth}
          class="house-segment"
        >
          <title>House {house.num} · {HOUSE_MEANINGS[house.num] || ''}</title>
        </path>
        <!-- House cusp line -->
        {@const cuspStart = polarToCartesian(CX, CY, activeHouseInner, house.startAngle)}
        {@const cuspEnd = polarToCartesian(CX, CY, activeHouseOuter, house.startAngle)}
        <line
          x1={cuspStart.x} y1={cuspStart.y}
          x2={cuspEnd.x} y2={cuspEnd.y}
          stroke="rgba(148,163,184,0.3)"
          stroke-width="0.75"
        />
        <!-- House number -->
        {@const numPos = polarToCartesian(CX, CY, midRadius, house.midAngle)}
        <text
          x={numPos.x}
          y={numPos.y}
          text-anchor="middle"
          dominant-baseline="central"
          class="house-number"
          fill="rgba(226,232,240,0.55)"
        >
          <title>House {house.num} · {HOUSE_MEANINGS[house.num] || ''}</title>
          {house.num}
        </text>
      {/each}
    </g>

    <!-- Inner disc background -->
    <circle cx={CX} cy={CY} r={activePolarityRingInner} fill="rgba(15,23,42,0.6)" stroke="rgba(148,163,184,0.1)" stroke-width="0.5" />

    <!-- Element ring (continuous from houses inner) -->
    <g id="{uid}-element-ring">
      {#each zodiacSegments as seg}
        {@const midRadius = activeElementLabelRadius}
        {@const ringWidth = activeElementRingOuter - activeElementRingInner}
        <!-- Background arc -->
        <path
          d={describeArcCCW(CX, CY, midRadius, seg.startDeg, seg.endDeg)}
          fill="none"
          stroke={hexToRgba(seg.color, 0.08)}
          stroke-width={ringWidth}
        />
        <!-- Element icon -->
        {@const iconPos = polarToCartesian(CX, CY, midRadius, seg.midDeg)}
        <text
          x={iconPos.x}
          y={iconPos.y}
          text-anchor="middle"
          dominant-baseline="central"
          class="element-icon"
          fill={hexToRgba(seg.color, 0.8)}
        >
          <title>{seg.element}</title>
          {ELEMENT_ICON[seg.element] || '?'}
        </text>
      {/each}
    </g>

    <!-- Quality ring (continuous from element inner) -->
    <g id="{uid}-quality-ring">
      {#each zodiacSegments as seg}
        {@const midRadius = activeQualityLabelRadius}
        {@const ringWidth = activeQualityRingOuter - activeQualityRingInner}
        <!-- Background arc -->
        <path
          d={describeArcCCW(CX, CY, midRadius, seg.startDeg, seg.endDeg)}
          fill="none"
          stroke="rgba(148,163,184,0.06)"
          stroke-width={ringWidth}
        />
        <!-- Quality icon -->
        {@const qualPos = polarToCartesian(CX, CY, midRadius, seg.midDeg)}
        <text
          x={qualPos.x}
          y={qualPos.y}
          text-anchor="middle"
          dominant-baseline="central"
          class="quality-icon"
          fill="rgba(148,163,184,0.7)"
        >
          <title>{seg.quality}</title>
          {seg.qualityIcon}
        </text>
      {/each}
    </g>

    <!-- Polarity ring (continuous from quality inner) -->
    <g id="{uid}-polarity-ring">
      {#each zodiacSegments as seg}
        {@const midRadius = activePolarityLabelRadius}
        {@const ringWidth = activePolarityRingOuter - activePolarityRingInner}
        {@const polarityColor = seg.polarity?.symbol === '➕' ? 'rgba(253,186,116,0.06)' : 'rgba(147,197,253,0.06)'}
        <!-- Background arc -->
        <path
          d={describeArcCCW(CX, CY, midRadius, seg.startDeg, seg.endDeg)}
          fill="none"
          stroke={polarityColor}
          stroke-width={ringWidth}
        />
        <!-- Polarity icon -->
        {@const polarPos = polarToCartesian(CX, CY, midRadius, seg.midDeg)}
        <text
          x={polarPos.x}
          y={polarPos.y}
          text-anchor="middle"
          dominant-baseline="central"
          class="polarity-icon"
          fill={seg.polarity?.symbol === '➕' ? 'rgba(253,186,116,0.7)' : 'rgba(147,197,253,0.7)'}
        >
          <title>{seg.polarity?.label || ''}</title>
          {seg.polarity?.symbol || ''}
        </text>
      {/each}
    </g>

    <!-- Axis lines (ASC, DSC, MC, IC) - extend from inner disc to zodiac outer -->
    <g id="{uid}-axes">
      {#each axisLabels as axis}
        {@const innerPoint = polarToCartesian(CX, CY, activeAspectCircle, axis.angle)}
        {@const outerPoint = polarToCartesian(CX, CY, RADII.zodiacOuter + 5, axis.angle)}
        {@const labelPoint = polarToCartesian(CX, CY, RADII.zodiacOuter + 12, axis.angle)}
        <line
          x1={innerPoint.x} y1={innerPoint.y}
          x2={outerPoint.x} y2={outerPoint.y}
          stroke={axis.color}
          stroke-width="1.5"
          stroke-dasharray="4,2"
          opacity="0.6"
        />
        <text
          x={labelPoint.x}
          y={labelPoint.y}
          text-anchor="middle"
          dominant-baseline="central"
          class="axis-label"
          fill={axis.color}
        >
          {axis.label}
        </text>
      {/each}
    </g>

    <!-- Inner aspect circle -->
    <circle
      cx={CX}
      cy={CY}
      r={activeAspectCircle}
      fill="rgba(15,23,42,0.7)"
      stroke="rgba(148,163,184,0.2)"
      stroke-width="0.5"
    />
  </svg>

  <!-- Summary chips overlay -->
  {#if primaryChip || secondaryChip}
    <div class="adv-sky-center" class:adv-sky-center-dual={isDualMode && secondaryChip}>
      {#if isDualMode && secondaryChip}
        <div class="adv-sky-chip-slot adv-sky-chip-left">
          {#if primaryChip}
            <div class="adv-sky-chip">
              <div class="adv-sky-chip-title" style={`color:${primaryChip.titleColor || '#22d3ee'}`}>{primaryChip.title || ''}</div>
              <div class="adv-sky-chip-main">{primaryChip.main || ''}</div>
              <div class="adv-sky-chip-meta">{primaryChip.meta || ''}</div>
            </div>
          {/if}
        </div>
        <div class="adv-sky-chip-slot adv-sky-chip-right">
          {#if secondaryChip}
            <div class="adv-sky-chip">
              <div class="adv-sky-chip-title" style={`color:${secondaryChip.titleColor || '#a855f7'}`}>{secondaryChip.title || ''}</div>
              <div class="adv-sky-chip-main">{secondaryChip.main || ''}</div>
              <div class="adv-sky-chip-meta">{secondaryChip.meta || ''}</div>
            </div>
          {/if}
        </div>
      {:else if primaryChip}
        <div class="adv-sky-chip">
          <div class="adv-sky-chip-title" style={`color:${primaryChip.titleColor || '#22d3ee'}`}>{primaryChip.title || ''}</div>
          <div class="adv-sky-chip-main">{primaryChip.main || ''}</div>
          <div class="adv-sky-chip-meta">{primaryChip.meta || ''}</div>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Fallback center info when no chips -->
    <div class="sky-center-info">
      {#if isDualMode}
        <div class="sky-center-dual">
          <span class="sky-label primary">{primaryLabel}</span>
          <span class="sky-separator">·</span>
          <span class="sky-label secondary">{secondaryLabel}</span>
        </div>
      {:else}
        <div class="sky-center-single">
          <span class="sky-label">{primaryLabel}</span>
        </div>
      {/if}
      {#if anchorDate}
        <div class="sky-date">{formatDate(anchorDate)}</div>
      {/if}
    </div>
  {/if}
  {#if isDualMode}
    <div class="sky-center-brand" aria-hidden="true">
      <span>✦</span>
    </div>
  {/if}
</div>

<style>
  .sky-map-v2 {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    margin: 0 auto;
  }

  .sky-map-svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .sign-text-path {
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    pointer-events: none;
  }

  .sign-date-label {
    font-size: 0.45rem;
    font-weight: 400;
    pointer-events: none;
  }

  .zodiac-segment {
    pointer-events: stroke;
  }

  .element-icon {
    font-size: 0.75rem;
    pointer-events: none;
  }

  .polarity-icon {
    font-size: 0.6rem;
    pointer-events: none;
  }

  .quality-icon {
    font-size: 0.7rem;
    font-weight: 600;
    pointer-events: none;
  }

  .house-number {
    font-size: 0.6rem;
    font-weight: 500;
    pointer-events: none;
  }

  .house-segment {
    pointer-events: stroke;
  }

  .axis-label {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .planet-glyph {
    fill: rgba(15, 23, 42, 0.9);
    font-weight: 600;
    pointer-events: none;
  }

  .planet-primary,
  .planet-secondary {
    cursor: pointer;
  }

  .planet-body {
    transition: transform 0.15s ease;
    transform-origin: center;
    transform-box: fill-box;
  }

  .planet-primary:hover .planet-body,
  .planet-secondary:hover .planet-body {
    transform: scale(1.14);
  }

  .sky-center-info {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
  }

  .sky-center-brand {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 44px;
    height: 44px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.75), rgba(99, 102, 241, 0.6), rgba(52, 211, 153, 0.75));
    box-shadow: 0 10px 24px rgba(8, 23, 42, 0.55), 0 0 0 1px rgba(148, 163, 184, 0.25);
    color: rgba(226, 232, 240, 0.95);
    font-size: 1.05rem;
    pointer-events: none;
  }

  .sky-center-dual,
  .sky-center-single {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .sky-label {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(226, 232, 240, 0.8);
  }

  .sky-label.primary {
    color: rgba(129, 140, 248, 0.9);
  }

  .sky-label.secondary {
    color: rgba(168, 85, 247, 0.9);
  }

  .sky-separator {
    color: rgba(148, 163, 184, 0.5);
  }

  .sky-date {
    font-size: 0.55rem;
    color: rgba(148, 163, 184, 0.7);
    margin-top: 0.25rem;
  }

  /* Summary chip styles (matching SkyMap v1) */
  .adv-sky-center {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    margin-top: 0;
  }

  .adv-sky-center-dual {
    align-items: flex-end;
    justify-content: space-between;
    padding: 0 0.75rem 0.75rem 0.75rem;
    gap: 0.5rem;
    width: 100%;
  }

  .adv-sky-chip-slot {
    display: flex;
    justify-content: center;
    pointer-events: none;
    flex: 1 1 0;
    min-width: 0;
  }

  .adv-sky-chip-left {
    justify-content: flex-start;
  }

  .adv-sky-chip-right {
    justify-content: flex-end;
  }

  .adv-sky-chip {
    pointer-events: auto;
    padding: 0.5rem 0.65rem;
    border-radius: 0.8rem;
    border: 1px solid rgba(125, 211, 252, 0.32);
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(8, 13, 26, 0.92));
    box-shadow: 0 12px 34px rgba(4, 7, 16, 0.55), 0 0 0 1px rgba(148, 163, 184, 0.08);
    max-width: 280px;
    text-align: center;
  }

  .adv-sky-chip-title {
    margin: 0;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #7dd3fc;
  }

  .adv-sky-chip-main {
    font-size: 0.85rem;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.95);
    white-space: nowrap;
  }

  .adv-sky-chip-meta {
    font-size: 0.58rem;
    color: rgba(148, 163, 184, 0.7);
    white-space: nowrap;
  }

  /* Responsive adjustments */
  @media (max-width: 400px) {
    .adv-sky-center-dual {
      gap: 0.5rem;
    }
    .adv-sky-chip {
      padding: 0.4rem 0.5rem;
    }
    .adv-sky-chip-main {
      font-size: 0.68rem;
    }
  }
</style>
