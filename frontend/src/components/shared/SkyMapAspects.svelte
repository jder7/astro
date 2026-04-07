<script>
  import { POINT_SYMBOLS, signSymbol, ELEMENT_HEX, signElement } from '$lib/astro/signs';
  import { aspectIcon, aspectHexColor } from '$lib/astro/aspects';
  import { configStore } from '$lib/state/configStore';
  import {
    normalizeAngle,
    polarToCartesian,
    describeArc,
    describeArcCCW,
    longitudeToChartAngle,
    angularDistance,
    normalizePointKey,
  } from '$lib/utils/geometry';

  export let aspects = [];
  export let points = {};
  export let houses = {};
  export let natalPoints = {};
  export let natalHouses = {};
  export let mode = 'natal';
  export let useNatalFramework = false;
  export let debug = false;
  export let primarySubjectName = 'Subject 1';
  export let secondarySubjectName = 'Subject 2';


  // Geometry constants
  const SIZE = 440;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const RADII = {
    outer: 190,
    zodiacOuter: 185,
    zodiacInner: 165,
    houseOuter: 162,
    houseInner: 145,
    planetTrackPrimary: 132,
    planetTrackSecondary: 115,  // secondary planets closer to center in dual mode
    innerCircleSingle: 120,     // aspect area for single mode (closer to primary)
    innerCircleDual: 100,       // aspect area for dual mode (closer to secondary)
  };

  // Planet sizing for collision handling
  const PLANET_SIZE = {
    sun: 14,
    moon: 10,
    mercury: 9,
    venus: 10,
    mars: 11,
    jupiter: 13,
    saturn: 12,
    uranus: 11,
    neptune: 11,
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

  // Sign data with element colors from project constants
  const SIGNS = [
    { key: 'ari', name: 'Aries', element: 'Fire' },
    { key: 'tau', name: 'Taurus', element: 'Earth' },
    { key: 'gem', name: 'Gemini', element: 'Air' },
    { key: 'can', name: 'Cancer', element: 'Water' },
    { key: 'leo', name: 'Leo', element: 'Fire' },
    { key: 'vir', name: 'Virgo', element: 'Earth' },
    { key: 'lib', name: 'Libra', element: 'Air' },
    { key: 'sco', name: 'Scorpio', element: 'Water' },
    { key: 'sag', name: 'Sagittarius', element: 'Fire' },
    { key: 'cap', name: 'Capricorn', element: 'Earth' },
    { key: 'aqu', name: 'Aquarius', element: 'Air' },
    { key: 'pis', name: 'Pisces', element: 'Water' },
  ];

  const getPlanetGlyph = (key) => POINT_SYMBOLS[normalizePointKey(key)] || '★';
  const getSignGlyph = (sign) => signSymbol(sign) || '★';
  const getPlanetSize = (key) => PLANET_SIZE[normalizePointKey(key)] || PLANET_SIZE.default;

  // Resolve active points from config
  $: activeSet = new Set(($configStore.active_points || []).map(normalizePointKey));

  // Mode flags
  $: isDualMode = mode === 'relationship' || mode === 'natal_transit';
  $: isRelationshipMode = mode === 'relationship';
  $: isTransitMode = mode === 'natal_transit';

  // Dynamic radii based on mode
  $: innerCircleRadius = isDualMode ? RADII.innerCircleDual : RADII.innerCircleSingle;
  $: primaryPlanetRadius = RADII.planetTrackPrimary;
  $: secondaryPlanetRadius = RADII.planetTrackSecondary;

  // For transit mode, always use natal houses; for relationship, allow switching
  // In transit mode: natalHouses is the framework, natalPoints are natal, points are transit
  $: activeHouses = isTransitMode ? natalHouses : (isRelationshipMode && useNatalFramework ? natalHouses : houses);
  $: activePoints = isTransitMode ? natalPoints : (isRelationshipMode && useNatalFramework ? natalPoints : points);
  $: displayPoints = isDualMode ? (isTransitMode ? points : (isRelationshipMode && useNatalFramework ? points : natalPoints)) : {};

  // Get ASC longitude for chart orientation
  const getAscLongitude = (housesObj) => {
    const asc = housesObj?.first_house || housesObj?.house_1 || Object.values(housesObj || {})[0];
    return asc?.abs_pos ?? asc?.position ?? 0;
  };

  $: ascLongitude = getAscLongitude(activeHouses);

  // Filter points by active configuration
  const filterPointsByActive = (pts, activeKeys) => {
    if (!pts || !activeKeys.size) return pts;
    return Object.fromEntries(
      Object.entries(pts).filter(([key]) => activeKeys.has(normalizePointKey(key)))
    );
  };

  $: filteredPoints = filterPointsByActive(activePoints, activeSet);
  $: filteredDisplayPoints = isDualMode ? filterPointsByActive(displayPoints, activeSet) : {};

  $: activePrimaryOwnerName = (() => {
    if (isTransitMode) return secondarySubjectName || 'Natal';
    if (isRelationshipMode) return useNatalFramework ? (secondarySubjectName || 'Subject 2') : (primarySubjectName || 'Subject 1');
    return primarySubjectName || 'Subject';
  })();
  $: activeSecondaryOwnerName = (() => {
    if (!isDualMode) return '';
    if (isTransitMode) return `${primarySubjectName || 'Transit'} (Transit)`;
    if (isRelationshipMode) return useNatalFramework ? (primarySubjectName || 'Subject 1') : (secondarySubjectName || 'Subject 2');
    return secondarySubjectName || 'Subject 2';
  })();
  $: primaryHousesToggleLabel = `${primarySubjectName || 'Subject 1'} Houses`;
  $: secondaryHousesToggleLabel = `${secondarySubjectName || 'Subject 2'} Houses`;

  // Build zodiac segments - each sign is 30° starting from 0° Aries
  // The wheel is oriented with ASC at 270° (9 o'clock), counterclockwise
  $: zodiacSegments = (() => {
    // Find which sign the ASC is in and its position within that sign
    const ascSignIdx = Math.floor(ascLongitude / 30);
    const ascPosInSign = ascLongitude % 30;
    
    return SIGNS.map((sign, idx) => {
      // Each sign spans 30°. Sign 0 (Aries) starts at 0° longitude.
      // We need to map zodiacal longitude to chart angle where ASC is at 270°.
      const signStartLon = idx * 30;
      const signEndLon = (idx + 1) * 30;
      
      // Convert to chart angles (ASC longitude maps to 270°)
      const startDeg = longitudeToChartAngle(signStartLon, ascLongitude);
      const endDeg = longitudeToChartAngle(signEndLon, ascLongitude);
      const midLon = signStartLon + 15;
      const midDeg = longitudeToChartAngle(midLon, ascLongitude);
      
      return {
        ...sign,
        idx,
        startDeg,
        endDeg,
        midDeg,
        signStartLon,
        signEndLon,
        symbol: getSignGlyph(sign.key),
        color: ELEMENT_HEX[sign.element] || ELEMENT_HEX.Default,
      };
    });
  })();

  // Map ordinal words to numbers
  const ORDINAL_TO_NUM = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
    seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12
  };

  // Build house cusps with element colors and sign info
  const buildHouseCusps = (housesObj, ascLon) => {
    if (!housesObj || !Object.keys(housesObj).length) return [];
    const cusps = [];
    const houseEntries = Object.entries(housesObj)
      .map(([key, house]) => {
        // Try numeric match first (house_1, house_2, etc.)
        const numMatch = key.match(/(\d+)/);
        if (numMatch) return { key, house, num: Number(numMatch[1]) };
        // Try ordinal match (first_house, second_house, etc.)
        const lowerKey = key.toLowerCase();
        for (const [ord, num] of Object.entries(ORDINAL_TO_NUM)) {
          if (lowerKey.includes(ord)) return { key, house, num };
        }
        return { key, house, num: null };
      })
      .filter((e) => e.num && e.num >= 1 && e.num <= 12)
      .sort((a, b) => a.num - b.num);

    houseEntries.forEach(({ house, num }, idx) => {
      const lon = house?.abs_pos ?? house?.position ?? 0;
      const angle = longitudeToChartAngle(lon, ascLon);
      const sign = house?.sign || '';
      const element = house?.element || signElement(sign) || 'Default';
      const color = ELEMENT_HEX[element] || ELEMENT_HEX.Default;
      const position = house?.position ?? (lon % 30);
      cusps.push({ num, angle, lon, sign, element, color, position });
    });
    return cusps;
  };

  $: houseCusps = buildHouseCusps(activeHouses, ascLongitude);

  // Identify ASC, DSC, MC, IC
  $: angleLabels = (() => {
    const labels = [];
    const asc = houseCusps.find((c) => c.num === 1);
    const dsc = houseCusps.find((c) => c.num === 7);
    const mc = houseCusps.find((c) => c.num === 10);
    const ic = houseCusps.find((c) => c.num === 4);
    if (asc) labels.push({ label: 'ASC', angle: asc.angle });
    if (dsc) labels.push({ label: 'DSC', angle: dsc.angle });
    if (mc) labels.push({ label: 'MC', angle: mc.angle });
    if (ic) labels.push({ label: 'IC', angle: ic.angle });
    return labels;
  })();

  // Build tick marks (1° faded, 10° visible)
  $: tickMarks = (() => {
    const ticks = [];
    for (let deg = 0; deg < 360; deg++) {
      const angle = normalizeAngle(180 - deg);
      const is10 = deg % 10 === 0;
      const innerR = is10 ? RADII.zodiacInner - 4 : RADII.zodiacInner - 2;
      const outerR = RADII.zodiacInner;
      const p1 = polarToCartesian(CX, CY, innerR, angle);
      const p2 = polarToCartesian(CX, CY, outerR, angle);
      ticks.push({
        x1: p1.x, y1: p1.y,
        x2: p2.x, y2: p2.y,
        stroke: is10 ? 'rgba(148,163,184,0.7)' : 'rgba(148,163,184,0.3)',
        strokeWidth: is10 ? 1 : 0.5,
      });
    }
    return ticks;
  })();

  // Planet collision resolution
  const resolvePlanetCollisions = (planetList) => {
    const sorted = [...planetList].sort((a, b) => b.size - a.size);
    const placed = [];

    sorted.forEach((planet) => {
      let { angle, radius, size } = planet;
      const conflict = placed.find(
        (p) => angularDistance(p.angle, angle) < 8 && Math.abs(p.radius - radius) < size
      );
      if (conflict) {
        if (Math.abs(conflict.size - size) < 2) {
          radius = radius - size / 2;
        }
      }
      placed.push({ ...planet, angle, radius, size });
    });
    return placed;
  };

  // Build planet positions
  const buildPlanetPositions = (pts, ascLon, baseRadius, owner = 'primary') => {
    return Object.entries(pts || {})
      .filter(([, p]) => p && typeof p === 'object')
      .map(([key, point]) => {
        const lon = point?.abs_pos ?? point?.position ?? null;
        if (!Number.isFinite(lon)) return null;
        const angle = longitudeToChartAngle(lon, ascLon);
        const size = getPlanetSize(key);
        return {
          key: normalizePointKey(key),
          name: point.name || key,
          angle,
          radius: baseRadius,
          size,
          sign: point.sign || '',
          position: point.position,
          lon,
          glyph: getPlanetGlyph(key),
          owner,
        };
      })
      .filter(Boolean);
  };

  $: primaryPlanets = resolvePlanetCollisions(
    buildPlanetPositions(filteredPoints, ascLongitude, primaryPlanetRadius, 'primary')
  );

  $: secondaryPlanets = isDualMode
    ? resolvePlanetCollisions(
        buildPlanetPositions(filteredDisplayPoints, ascLongitude, secondaryPlanetRadius, 'secondary')
      )
    : [];

  // Convert planet positions to SVG coords
  const planetToSvg = (planet) => {
    const coords = polarToCartesian(CX, CY, planet.radius, planet.angle);
    return { ...planet, x: coords.x, y: coords.y };
  };

  $: primaryPlanetsSvg = primaryPlanets.map(planetToSvg);
  $: secondaryPlanetsSvg = secondaryPlanets.map(planetToSvg);

  // Create a lookup map for all planets
  $: allPlanetsMap = (() => {
    const map = new Map();
    primaryPlanetsSvg.forEach((p) => map.set(`${p.key}_primary`, p));
    secondaryPlanetsSvg.forEach((p) => map.set(`${p.key}_secondary`, p));
    // Also add by key only for fallback
    primaryPlanetsSvg.forEach((p) => { if (!map.has(p.key)) map.set(p.key, p); });
    secondaryPlanetsSvg.forEach((p) => { if (!map.has(p.key)) map.set(p.key, p); });
    return map;
  })();

  // Build aspect lines with debugging
  $: aspectLines = (() => {
    const lines = [];
    const clipRadius = innerCircleRadius; // capture current value

    if (debug) {
      console.group('[SkyMapAspects] Building aspect lines');
      console.log('Available planets:', Array.from(allPlanetsMap.keys()));
      console.log('Primary planets:', primaryPlanetsSvg.map(p => ({
        key: p.key,
        angle: p.angle.toFixed(2),
        x: p.x.toFixed(2),
        y: p.y.toFixed(2),
        lon: p.lon,
      })));
      console.log('Secondary planets:', secondaryPlanetsSvg.map(p => ({
        key: p.key,
        angle: p.angle.toFixed(2),
        x: p.x.toFixed(2),
        y: p.y.toFixed(2),
        lon: p.lon,
      })));
    }

    aspects.forEach((aspect, idx) => {
      const leftRaw = aspect.leftRef || aspect.left || '';
      const rightRaw = aspect.rightRef || aspect.right || '';
      const leftKey = normalizePointKey(leftRaw);
      const rightKey = normalizePointKey(rightRaw);

      // Determine owner from aspect data if available
      const leftOwner = aspect.leftOwner || '1';
      const rightOwner = aspect.rightOwner || '2';

      // Try to find planets with owner suffix first, then fallback
      let p1 = allPlanetsMap.get(`${leftKey}_${leftOwner === '1' ? 'primary' : 'secondary'}`) ||
               allPlanetsMap.get(`${leftKey}_primary`) ||
               allPlanetsMap.get(`${leftKey}_secondary`) ||
               allPlanetsMap.get(leftKey);

      let p2 = allPlanetsMap.get(`${rightKey}_${rightOwner === '1' ? 'primary' : 'secondary'}`) ||
               allPlanetsMap.get(`${rightKey}_primary`) ||
               allPlanetsMap.get(`${rightKey}_secondary`) ||
               allPlanetsMap.get(rightKey);

      if (debug) {
        console.log(`Aspect ${idx}: ${leftRaw} (${leftKey}) -> ${rightRaw} (${rightKey})`);
        console.log(`  Left owner: ${leftOwner}, Right owner: ${rightOwner}`);
        console.log(`  P1 found:`, p1 ? { key: p1.key, x: p1.x.toFixed(2), y: p1.y.toFixed(2), angle: p1.angle.toFixed(2) } : 'NOT FOUND');
        console.log(`  P2 found:`, p2 ? { key: p2.key, x: p2.x.toFixed(2), y: p2.y.toFixed(2), angle: p2.angle.toFixed(2) } : 'NOT FOUND');
      }

      if (!p1 || !p2) {
        if (debug) console.warn(`  SKIPPED: Missing planet(s)`);
        return;
      }

      // Clip line endpoints to inner circle
      const clipToInner = (px, py) => {
        const dx = px - CX;
        const dy = py - CY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= clipRadius) return { x: px, y: py };
        const ratio = clipRadius / dist;
        return { x: CX + dx * ratio, y: CY + dy * ratio };
      };

      const c1 = clipToInner(p1.x, p1.y);
      const c2 = clipToInner(p2.x, p2.y);
      const color = aspectHexColor(aspect.name);
      const orbVal = typeof aspect.orb === 'number' ? aspect.orb : parseFloat(String(aspect.orb || '').replace('°', ''));

      if (debug) {
        console.log(`  Line: (${c1.x.toFixed(2)}, ${c1.y.toFixed(2)}) -> (${c2.x.toFixed(2)}, ${c2.y.toFixed(2)})`);
      }

      lines.push({
        x1: c1.x, y1: c1.y,
        x2: c2.x, y2: c2.y,
        color,
        aspectName: aspect.name,
        leftName: aspect.left || leftKey,
        rightName: aspect.right || rightKey,
        leftSource: p1.owner === 'primary' ? activePrimaryOwnerName : activeSecondaryOwnerName,
        rightSource: p2.owner === 'primary' ? activePrimaryOwnerName : activeSecondaryOwnerName,
        orb: Number.isFinite(orbVal) ? orbVal : null,
        orbStr: Number.isFinite(orbVal) ? `${orbVal >= 0 ? '+' : ''}${orbVal.toFixed(2)}°` : '',
        glyph: aspectIcon(aspect.name),
        p1Debug: { key: p1.key, angle: p1.angle, x: p1.x, y: p1.y },
        p2Debug: { key: p2.key, angle: p2.angle, x: p2.x, y: p2.y },
      });
    });

    if (debug) {
      console.log(`Total lines created: ${lines.length}`);
      console.groupEnd();
    }

    return lines;
  })();

  // Orthogonal axis points for orientation
  $: axisPoints = {
    // ASC at 270° (9 o'clock/left), DSC at 90° (3 o'clock/right) - stretch to viewBox edges
    asc1: { x: 0, y: CY },
    dsc1: { x: SIZE, y: CY },
    // MC at 0° (12 o'clock/top), IC at 180° (6 o'clock/bottom) - stretch to viewBox edges
    mc1: { x: CX, y: 0 },
    ic1: { x: CX, y: SIZE },
    // Label positions (outside the chart)
    ascLabel: polarToCartesian(CX, CY, RADII.outer + 6, 270),
    dscLabel: polarToCartesian(CX, CY, RADII.outer + 6, 90),
    mcLabel: polarToCartesian(CX, CY, RADII.outer + 6, 0),
    icLabel: polarToCartesian(CX, CY, RADII.outer + 6, 180),
  };

  const toggleFramework = () => {
    useNatalFramework = !useNatalFramework;
  };
</script>

<div class="skymap-aspects-container">
  <!-- Toggle only for relationship mode (transit always uses natal houses) -->
  {#if isRelationshipMode}
    <div id="aspects-skymap-framework-toggle" class="skymap-aspects-toggle skymap-aspects-framework-toggle">
      <button
        type="button"
        id="aspects-skymap-primary-houses-btn"
        class="toggle-btn skymap-aspects-framework-btn skymap-aspects-framework-btn-primary"
        class:active={!useNatalFramework}
        on:click={toggleFramework}
        aria-pressed={!useNatalFramework}
      >
        {primaryHousesToggleLabel}
      </button>
      <button
        type="button"
        id="aspects-skymap-secondary-houses-btn"
        class="toggle-btn skymap-aspects-framework-btn skymap-aspects-framework-btn-secondary"
        class:active={useNatalFramework}
        on:click={toggleFramework}
        aria-pressed={useNatalFramework}
      >
        {secondaryHousesToggleLabel}
      </button>
    </div>
  {/if}

  <svg
    id="asp-sky-svg"
    viewBox="0 0 {SIZE} {SIZE}"
    class="skymap-aspects-svg"
    role="img"
    aria-label="Astrological sky map with aspects"
  >
    <defs>
      <clipPath id="asp-sky-inner-clip">
        <circle cx={CX} cy={CY} r={innerCircleRadius} />
      </clipPath>
      <radialGradient id="asp-sky-bg-gradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(15,23,42,0.95)" />
        <stop offset="100%" stop-color="rgba(2,6,23,0.98)" />
      </radialGradient>
    </defs>

    <!-- Background -->
    <circle id="asp-sky-background" cx={CX} cy={CY} r={RADII.outer} fill="url(#asp-sky-bg-gradient)" />

    <!-- Orthogonal axis cross (ASC-DSC, MC-IC) -->
    <!-- Horizontal axis (ASC-DSC) -->
    <line id="asp-sky-axis-asc-dsc" x1={axisPoints.asc1.x} y1={axisPoints.asc1.y} x2={axisPoints.dsc1.x} y2={axisPoints.dsc1.y} stroke="rgba(167,139,250,0.25)" stroke-width="1" stroke-dasharray="4,3" />
    <!-- Vertical axis (MC-IC) -->
    <line id="asp-sky-axis-mc-ic" x1={axisPoints.mc1.x} y1={axisPoints.mc1.y} x2={axisPoints.ic1.x} y2={axisPoints.ic1.y} stroke="rgba(167,139,250,0.25)" stroke-width="1" stroke-dasharray="4,3" />

    <!-- Zodiac ring -->
    <g id="asp-sky-zodiac-ring">
      {#each zodiacSegments as seg}
        {@const boundaryStart = polarToCartesian(CX, CY, RADII.zodiacInner, seg.startDeg)}
        {@const boundaryEnd = polarToCartesian(CX, CY, RADII.zodiacOuter, seg.startDeg)}
        {@const glyphPos = polarToCartesian(CX, CY, (RADII.zodiacOuter + RADII.zodiacInner) / 2, seg.midDeg)}
        <g id="asp-sky-sign-{seg.key}">
          <path
            id="asp-sky-sign-bg-{seg.key}"
            d={describeArcCCW(CX, CY, (RADII.zodiacOuter + RADII.zodiacInner) / 2, seg.startDeg, seg.endDeg)}
            fill="none"
            stroke={seg.color}
            stroke-width={RADII.zodiacOuter - RADII.zodiacInner}
            opacity="0.25"
          >
            <title>{seg.name} ({seg.element})</title>
          </path>
          <!-- Sign boundary -->
          <line
            id="asp-sky-sign-boundary-{seg.key}"
            x1={boundaryStart.x} y1={boundaryStart.y}
            x2={boundaryEnd.x} y2={boundaryEnd.y}
            stroke="rgba(226,232,240,0.4)"
            stroke-width="1"
          />
          <!-- Sign glyph -->
          <text
            id="asp-sky-sign-glyph-{seg.key}"
            x={glyphPos.x}
            y={glyphPos.y}
            text-anchor="middle"
            dominant-baseline="central"
            class="sign-glyph"
            fill={seg.color}
          >
            <title>{seg.name} ({seg.element})</title>
            {seg.symbol}
          </text>
        </g>
      {/each}
    </g>

    <!-- Tick marks -->
    <g id="asp-sky-tick-marks">
      {#each tickMarks as tick, tickIdx}
        <line
          id="asp-sky-tick-{tickIdx}"
          x1={tick.x1} y1={tick.y1}
          x2={tick.x2} y2={tick.y2}
          stroke={tick.stroke}
          stroke-width={tick.strokeWidth}
        />
      {/each}
    </g>

    <!-- Houses ring outlines -->
    <circle id="asp-sky-house-outer-ring" cx={CX} cy={CY} r={RADII.houseOuter} fill="none" stroke="rgba(148,163,184,0.4)" stroke-width="0.75" />
    <circle id="asp-sky-house-inner-ring" cx={CX} cy={CY} r={RADII.houseInner} fill="none" stroke="rgba(148,163,184,0.35)" stroke-width="0.5" />

    <!-- House sectors with translucent element color overlay -->
    <g id="asp-sky-houses">
      {#each houseCusps as cusp, idx}
        {@const nextCusp = houseCusps[(idx + 1) % 12]}
        {@const arcEndAngle = nextCusp.angle}
        {@const innerPt = polarToCartesian(CX, CY, RADII.houseInner, cusp.angle)}
        {@const outerPt = polarToCartesian(CX, CY, RADII.houseOuter, cusp.angle)}
        <g id="asp-sky-house-{cusp.num}">
          <!-- House sector background - translucent element color -->
          <path
            id="asp-sky-house-bg-{cusp.num}"
            d={describeArcCCW(CX, CY, (RADII.houseOuter + RADII.houseInner) / 2, cusp.angle, arcEndAngle)}
            fill="none"
            stroke={cusp.color}
            stroke-width={RADII.houseOuter - RADII.houseInner - 2}
            stroke-opacity="0.15"
          >
            <title>House {cusp.num} - {cusp.sign} {cusp.position?.toFixed(1)}° ({cusp.element})</title>
          </path>
          <!-- House cusp line -->
          <line
            id="asp-sky-house-cusp-{cusp.num}"
            x1={innerPt.x} y1={innerPt.y}
            x2={outerPt.x} y2={outerPt.y}
            stroke="rgba(148,163,184,0.35)"
            stroke-width="0.75"
          >
            <title>House {cusp.num} cusp - {cusp.sign} {cusp.position?.toFixed(1)}°</title>
          </line>
        </g>
      {/each}
    </g>

    <!-- House labels (rendered separately for visibility) -->
    <g id="asp-sky-house-labels">
      {#each houseCusps as cusp, idx}
        {@const nextCusp = houseCusps[(idx + 1) % 12]}
        {@const angleDiff = nextCusp.angle - cusp.angle}
        {@const normalizedDiff = angleDiff > 180 ? angleDiff - 360 : (angleDiff < -180 ? angleDiff + 360 : angleDiff)}
        {@const midAngle = normalizeAngle(cusp.angle + normalizedDiff / 2)}
        {@const labelPos = polarToCartesian(CX, CY, (RADII.houseInner + RADII.houseOuter) / 2, midAngle)}
        <text
          id="asp-sky-house-label-{cusp.num}"
          x={labelPos.x}
          y={labelPos.y}
          text-anchor="middle"
          dominant-baseline="central"
          font-size="8"
          fill="rgba(148,163,184,0.9)"
        >{cusp.num}</text>
      {/each}
    </g>

    <!-- Inner circle for aspects -->
    <circle id="asp-sky-aspect-area" cx={CX} cy={CY} r={innerCircleRadius} fill="none" stroke="rgba(148,163,184,0.15)" stroke-width="0.75" />

    <!-- Separator between primary and secondary planet areas (dual mode only) -->
    {#if isDualMode}
      <circle id="asp-sky-planets-separator" cx={CX} cy={CY} r={(primaryPlanetRadius + secondaryPlanetRadius) / 2} fill="none" stroke="rgba(148,163,184,0.25)" stroke-width="0.5" stroke-dasharray="3,3" />
    {/if}

    <!-- Aspect lines (clipped to inner circle) -->
    <g id="asp-sky-aspects" clip-path="url(#asp-sky-inner-clip)">
      {#each aspectLines as line, lineIdx}
        <line
          id="asp-sky-aspect-{lineIdx}"
          x1={line.x1} y1={line.y1}
          x2={line.x2} y2={line.y2}
          stroke={line.color}
          stroke-width="1.5"
          stroke-opacity="0.75"
        >
          <title>{line.leftName} ({line.leftSource}) {line.glyph} {line.rightName} ({line.rightSource}) - {line.aspectName} ({line.orbStr})</title>
        </line>
      {/each}
    </g>

    <!-- Primary planets -->
    <g id="asp-sky-planets-primary">
      {#each primaryPlanetsSvg as planet}
        <g id="asp-sky-planet-primary-{planet.key}" class="planet-marker primary" transform="translate({planet.x}, {planet.y})">
          <circle
            r={planet.size / 2}
            fill="rgba(15,23,42,0.85)"
            stroke="rgba(226,232,240,0.5)"
            stroke-width="1"
          />
          <text
            text-anchor="middle"
            dominant-baseline="central"
            class="planet-glyph"
            font-size={planet.size * 0.9}
          >
            <title>{planet.name} in {planet.sign} ({planet.position?.toFixed(1) || '—'}°) ({activePrimaryOwnerName})</title>
            {planet.glyph}
          </text>
        </g>
      {/each}
    </g>

    <!-- Secondary planets (dual mode) -->
    <g id="asp-sky-planets-secondary">
      {#each secondaryPlanetsSvg as planet}
        <g id="asp-sky-planet-secondary-{planet.key}" class="planet-marker secondary" transform="translate({planet.x}, {planet.y})">
          <circle
            r={planet.size / 2}
            fill="rgba(30,41,59,0.85)"
            stroke="rgba(167,139,250,0.5)"
            stroke-width="1"
          />
          <text
            text-anchor="middle"
            dominant-baseline="central"
            class="planet-glyph secondary"
            font-size={planet.size * 0.85}
          >
            <title>{planet.name} in {planet.sign} ({planet.position?.toFixed(1) || '—'}°) ({activeSecondaryOwnerName})</title>
            {planet.glyph}
          </text>
        </g>
      {/each}
    </g>

    <!-- Axis labels (rendered last to be on top) -->
    <text id="asp-sky-label-asc" x={axisPoints.ascLabel.x} y={axisPoints.ascLabel.y} text-anchor="end" dominant-baseline="central" class="axis-label">ASC</text>
    <text id="asp-sky-label-dsc" x={axisPoints.dscLabel.x} y={axisPoints.dscLabel.y} text-anchor="start" dominant-baseline="central" class="axis-label">DSC</text>
    <text id="asp-sky-label-mc" x={axisPoints.mcLabel.x} y={axisPoints.mcLabel.y} text-anchor="middle" dominant-baseline="auto" class="axis-label">MC</text>
    <text id="asp-sky-label-ic" x={axisPoints.icLabel.x} y={axisPoints.icLabel.y} text-anchor="middle" dominant-baseline="hanging" class="axis-label">IC</text>
  </svg>
</div>

<style>
  .skymap-aspects-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  .skymap-aspects-toggle {
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem;
    background: rgba(30, 41, 59, 0.6);
    border-radius: 0.5rem;
    border: 1px solid rgba(71, 85, 105, 0.4);
  }

  .toggle-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(203, 213, 225, 0.7);
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn:hover {
    color: rgba(226, 232, 240, 0.9);
    background: rgba(51, 65, 85, 0.5);
  }

  .toggle-btn.active {
    color: #e2e8f0;
    background: rgba(56, 189, 248, 0.2);
    border: 1px solid rgba(56, 189, 248, 0.4);
  }

  .skymap-aspects-svg {
    width: 100%;
    max-width: 680px;
    height: auto;
    aspect-ratio: 1;
  }

  .sign-glyph {
    font-size: 1rem;
    font-weight: 500;
  }

  .house-label {
    font-size: 0.6rem;
    fill: rgba(148, 163, 184, 0.7);
    font-weight: 500;
  }

  .axis-label {
    font-size: 0.5rem;
    fill: rgba(167, 139, 250, 0.6);
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .planet-glyph {
    fill: rgba(226, 232, 240, 0.95);
  }

  .planet-glyph.secondary {
    fill: rgba(167, 139, 250, 0.9);
  }

  @media (max-width: 480px) {
    .skymap-aspects-svg {
      max-width: 320px;
    }

    .sign-glyph {
      font-size: 0.85rem;
    }

    .toggle-btn {
      padding: 0.25rem 0.5rem;
      font-size: 0.7rem;
    }
  }
</style>
