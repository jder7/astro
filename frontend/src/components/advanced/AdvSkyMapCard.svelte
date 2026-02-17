<script>
  import { formatDegree } from '$lib/astro/format';
  import { collectPoints, extractPointRanges, extractSubjects, formatHouseName } from '$lib/astro/advanced';
  import { ELEMENT_HEX, ELEMENT_ICON, POINT_SYMBOLS, QUALITY_ICON, houseRoman, signName, signSymbol } from '$lib/astro/signs';
  import { configStore } from '$lib/state/configStore';
  import SkyMap from '$components/shared/SkyMap.svelte';
  import CardHeader from '$components/shared/CardHeader.svelte';

  export let response = null;
  export let mode = 'natal';
  export let onRequestTimeRangeSweeps = null;
  export let loading = false;
  let collapsed = true;

  const normalizePointKey = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]+/g, '');

  const normalizeRangeId = (value) => (typeof value === 'string' ? value.toLowerCase() : null);
  const HOUSE_WORD_TO_NUM = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10,
    eleventh: 11,
    twelfth: 12,
  };
  const PLANET_KEYS = new Set(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron']);

  const pickFirst = (...values) => {
    for (const value of values) {
      if (value !== null && value !== undefined) return value;
    }
    return null;
  };

  const filterPointsByActive = (points, activeSet) => {
    if (!points || typeof points !== 'object' || !activeSet || !activeSet.size) return points || {};
    return Object.fromEntries(Object.entries(points).filter(([key]) => activeSet.has(normalizePointKey(key))));
  };

  const addPointsForRange = (map, id, subjectData, activeSet) => {
    const key = normalizeRangeId(id);
    if (!key || !subjectData) return;
    const collected = collectPoints(subjectData).points || {};
    const filtered = filterPointsByActive(collected, activeSet);
    if (Object.keys(filtered).length) {
      map[key] = filtered;
    }
  };

  const addHousesForRange = (map, id, subjectData) => {
    const key = normalizeRangeId(id);
    if (!key || !subjectData) return;
    const collected = collectPoints(subjectData).houses || {};
    if (Object.keys(collected).length) {
      map[key] = collected;
    }
  };

  const shapePoint = ([key, point]) => {
    const retro = point?.retrograde ? 'Rx' : '';
    const elementColor = ELEMENT_HEX[point.element] || ELEMENT_HEX.Default;
    return {
      key,
      label: point.name || key,
      icon: POINT_SYMBOLS[key] || '★',
      sign: signName(point.sign),
      signIcon: signSymbol(point.sign),
      element: point.element || '',
    elementIcon: ELEMENT_ICON[point.element] || '',
      quality: point.quality || '',
    qualityIcon: QUALITY_ICON[point.quality] || '',
      degree: Number.isFinite(point.position) ? formatDegree(point.position) : '',
      house: formatHouseName(point.house),
      retro,
      elementColor,
    };
  };

  const shapeHouse = ([key, house]) => ({
    num: houseNumFromValues(house?.house_num, house?.house, house?.name, key),
    key,
    label: houseRoman(house.house || house.name || key) || formatHouseName(house.house || house.name || key),
    sign: signName(house.sign),
    signIcon: signSymbol(house.sign),
    element: house.element || '',
  elementIcon: ELEMENT_ICON[house.element] || '',
    quality: house.quality || '',
  qualityIcon: QUALITY_ICON[house.quality] || '',
    degree: Number.isFinite(house.position) ? formatDegree(house.position) : '',
  elementColor: ELEMENT_HEX[house.element] || ELEMENT_HEX.Default,
  });

  const parseHousePlanetsMap = (value) => {
    const raw = value?.houses && typeof value.houses === 'object' ? value.houses : value;
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.entries(raw).forEach(([key, list]) => {
      const houseNum = Number(key);
      if (!Number.isInteger(houseNum) || houseNum < 1 || houseNum > 12) return;
      out[houseNum] = Array.isArray(list) ? list.map((item) => normalizePointKey(item)).filter(Boolean) : [];
    });
    return out;
  };

  const houseNumFromValues = (...values) => {
    for (const value of values) {
      const asNumber = Number(String(value ?? '').trim());
      if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 12) return asNumber;
      const raw = String(value || '')
        .trim()
        .toLowerCase();
      if (!raw) continue;
      const digitMatch = raw.match(/(\d+)/);
      if (digitMatch) {
        const parsed = Number(digitMatch[1]);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 12) return parsed;
      }
      for (const [word, num] of Object.entries(HOUSE_WORD_TO_NUM)) {
        if (raw.includes(word)) return num;
      }
    }
    return null;
  };

  const buildOwnPlanetsByHouse = (points = {}, activePlanetOrder = []) => {
    const houses = Object.fromEntries(Array.from({ length: 12 }, (_, idx) => [idx + 1, []]));
    const pointsByNorm = {};
    Object.entries(points || {}).forEach(([key, point]) => {
      const normKey = normalizePointKey(key);
      if (!normKey || !PLANET_KEYS.has(normKey)) return;
      pointsByNorm[normKey] = point;
    });
    const ordered = activePlanetOrder.filter((key) => PLANET_KEYS.has(key));
    ordered.forEach((planetKey) => {
      const point = pointsByNorm[planetKey];
      if (!point || typeof point !== 'object') return;
      const houseNum = houseNumFromValues(point.house_num, point.house);
      if (!houseNum) return;
      houses[houseNum].push(planetKey);
    });
    return houses;
  };

  const pointLabel = (key) =>
    String(key || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();

  const buildPointMeta = (points = {}) => {
    const out = {};
    Object.entries(points || {}).forEach(([key, point]) => {
      const normKey = normalizePointKey(key);
      if (!normKey) return;
      out[normKey] = {
        icon: POINT_SYMBOLS[normKey] || '★',
        name: point?.name || pointLabel(normKey),
      };
    });
    return out;
  };

  const planetsForHouse = (map, houseNum) => {
    const list = map?.[Number(houseNum)];
    return Array.isArray(list) ? list : [];
  };

  const planetsIcons = (map, houseNum, pointMeta) =>
    planetsForHouse(map, houseNum)
      .map((key) => pointMeta?.[key]?.icon || POINT_SYMBOLS[key] || '★')
      .join(' ');

  const planetsTooltip = (map, houseNum, pointMeta) =>
    planetsForHouse(map, houseNum)
      .map((key) => `${pointMeta?.[key]?.icon || POINT_SYMBOLS[key] || '★'} ${pointMeta?.[key]?.name || pointLabel(key)}`)
      .join(', ');

  $: subjects = extractSubjects(response, mode);
  $: primaryPoints = collectPoints(subjects.primary || {});
  $: natalPoints = collectPoints(subjects.natal || {});
  $: filteredPrimaryPoints = filterPointsByActive(primaryPoints.points, activeSet);
  $: pointRows = Object.entries(filteredPrimaryPoints || {}).map(shapePoint);
  $: houseRows = Object.entries(primaryPoints.houses || {})
    .map(shapeHouse)
    .sort((a, b) => (a.num || 99) - (b.num || 99));
  $: filteredNatalPoints = filterPointsByActive(natalPoints.points, activeSet);
  $: natalPointRows = Object.entries(filteredNatalPoints || {}).map(shapePoint);
  $: natalHouseRows = Object.entries(natalPoints.houses || {})
    .map(shapeHouse)
    .sort((a, b) => (a.num || 99) - (b.num || 99));
  $: sunRanges = extractPointRanges(response, 'sun') || [];
  $: activeSet = new Set(($configStore?.active_points || []).map(normalizePointKey));
  $: activePlanetOrder = ($configStore?.active_points || []).map(normalizePointKey).filter((key) => PLANET_KEYS.has(key));
  $: houseProjections = pickFirst(
    response?.snapshot?.houseProjections,
    response?.snapshot?.house_projections,
    response?.houseProjections,
    response?.house_projections
  );
  $: transitIntoNatal = parseHousePlanetsMap(pickFirst(houseProjections?.transitIntoNatal, houseProjections?.transit_into_natal));
  $: firstIntoSecond = parseHousePlanetsMap(pickFirst(houseProjections?.firstIntoSecond, houseProjections?.first_into_second));
  $: secondIntoFirst = parseHousePlanetsMap(pickFirst(houseProjections?.secondIntoFirst, houseProjections?.second_into_first));
  $: primaryProjectedPlanets = mode === 'relationship' ? secondIntoFirst : {};
  $: natalProjectedPlanets = mode === 'natal_transit' ? transitIntoNatal : mode === 'relationship' ? firstIntoSecond : {};
  $: showPrimaryProjectedColumn = mode === 'relationship';
  $: showNatalProjectedColumn = mode === 'natal_transit' || mode === 'relationship';
  $: primaryOwnPlanets = buildOwnPlanetsByHouse(primaryPoints.points || {}, activePlanetOrder);
  $: natalOwnPlanets = buildOwnPlanetsByHouse(natalPoints.points || {}, activePlanetOrder);
  $: primaryPointMeta = buildPointMeta(primaryPoints.points || {});
  $: natalPointMeta = buildPointMeta(natalPoints.points || {});
  $: pointsByRangeId = (() => {
    const map = {};
    addPointsForRange(map, 'transit', response?.snapshot?.subject, activeSet);
    addPointsForRange(map, 'natal', response?.snapshot?.natal_subject, activeSet);
    if (!response?.snapshot) {
      addPointsForRange(map, 'natal', response?.subject, activeSet);
    }
    addPointsForRange(map, 'first', response?.first_subject, activeSet);
    addPointsForRange(map, 'second', response?.second_subject, activeSet);
    sunRanges.forEach((range, idx) => {
      const key = normalizeRangeId(range.id || range.label || `range-${idx}`);
      if (key && !map[key]) {
        addPointsForRange(map, key, subjects.primary, activeSet);
      }
    });
    const primaryFiltered = filterPointsByActive(primaryPoints.points, activeSet);
    if (Object.keys(primaryFiltered).length) {
      map.default = primaryFiltered;
    }
    return map;
  })();
  $: housesByRangeId = (() => {
    const map = {};
    addHousesForRange(map, 'transit', response?.snapshot?.subject);
    addHousesForRange(map, 'natal', response?.snapshot?.natal_subject);
    if (!response?.snapshot) {
      addHousesForRange(map, 'natal', response?.subject);
    }
    addHousesForRange(map, 'first', response?.first_subject);
    addHousesForRange(map, 'second', response?.second_subject);
    sunRanges.forEach((range, idx) => {
      const key = normalizeRangeId(range.id || range.label || `range-${idx}`);
      if (key && !map[key]) {
        map[key] = primaryPoints.houses || {};
      }
    });
    if (Object.keys(primaryPoints.houses || {}).length) {
      map.default = primaryPoints.houses;
    }
    return map;
  })();

  const primaryAccent = '#22d3ee';
  const secondaryAccent = '#c084fc';

  $: if (!collapsed && response && onRequestTimeRangeSweeps && !sunRanges.length) {
    onRequestTimeRangeSweeps('sun');
  }
</script>

<div class="flowbite-card space-y-4">
  <div class="card-head card-head-inline">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Sky map</p>
      <h2>Points &amp; Houses</h2>
    </div>
    <div class="card-head-actions">
      <button
        type="button"
        class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition"
        on:click={() => (collapsed = !collapsed)}
        aria-expanded={!collapsed}
        aria-controls="adv-skymap-panel"
        aria-label={collapsed ? 'Expand sky map panel' : 'Collapse sky map panel'}
      >
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
        </svg>
      </button>
    </div>
  </div>

  {#if !collapsed}
    <div id="adv-skymap-panel" class="space-y-4">
      {#if !response}
        <p class="text-sm text-slate-400">Generate a chart to see point and house placements.</p>
      {:else}
        {#if sunRanges.length}
          <SkyMap ranges={sunRanges} pointsByRangeId={pointsByRangeId} housesByRangeId={housesByRangeId} />
        {:else}
          <p class="text-sm text-slate-400">{loading ? 'Loading Sun ranges...' : 'No Sun ranges returned for this chart.'}</p>
        {/if}

        <div class="space-y-5">
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <span class="subject-badge" style={`--badge:${primaryAccent};`}>{subjects.primary?.name || 'Subject 1'}</span>
              <CardHeader label="Points" badge={pointRows.length} />
            </div>
            {#if pointRows.length}
              <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                  <thead class="text-slate-400">
                    <tr>
                      <th class="py-2 pr-3 text-left">Body</th>
                      <th class="py-2 pr-3 text-left">Sign</th>
                      <th class="py-2 pr-3 text-left">Element</th>
                      <th class="py-2 pr-3 text-left">Quality</th>
                      <th class="py-2 pr-3 text-left">Degree</th>
                      <th class="py-2 pr-3 text-left">House</th>
                      <th class="py-2 pr-3 text-left">Retro</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    {#each pointRows as row}
                      <tr>
                        <td class="py-2 pr-3">{row.icon} {row.label}</td>
                        <td class="py-2 pr-3">{row.sign} {row.signIcon}</td>
                        <td class="py-2 pr-3">
                          <span style={`color:${row.elementColor}`}>{row.elementIcon} {row.element || '—'}</span>
                        </td>
                        <td class="py-2 pr-3">{row.qualityIcon} {row.quality || '—'}</td>
                        <td class="py-2 pr-3">{row.degree || '—'}</td>
                        <td class="py-2 pr-3">{row.house || '—'}</td>
                        <td class="py-2 pr-3">{row.retro || '—'}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <p class="text-sm text-slate-400">No points returned.</p>
            {/if}
          </div>

          <div class="space-y-3">
            {#if houseRows.length}
              <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                  <thead class="text-slate-400">
                    <tr>
                      <th class="py-2 pr-3 text-left">House</th>
                      <th class="py-2 pr-3 text-left">Sign</th>
                      <th class="py-2 pr-3 text-left">Planets</th>
                      {#if showPrimaryProjectedColumn}
                        <th class="py-2 pr-3 text-left">Projected</th>
                      {/if}
                      <th class="py-2 pr-3 text-left">Element</th>
                      <th class="py-2 pr-3 text-left">Quality</th>
                      <th class="py-2 pr-3 text-left">Degree</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    {#each houseRows as row}
                      <tr>
                        <td class="py-2 pr-3">{row.label}</td>
                        <td class="py-2 pr-3">{row.sign} {row.signIcon}</td>
                        <td class="py-2 pr-3">
                          {#if planetsForHouse(primaryOwnPlanets, row.num).length}
                            {@const tooltip = planetsTooltip(primaryOwnPlanets, row.num, primaryPointMeta)}
                            <span class="house-proj-icons" title={tooltip} aria-label={tooltip}>
                              {planetsIcons(primaryOwnPlanets, row.num, primaryPointMeta)}
                            </span>
                          {:else}
                            —
                          {/if}
                        </td>
                        {#if showPrimaryProjectedColumn}
                          <td class="py-2 pr-3">
                            {#if planetsForHouse(primaryProjectedPlanets, row.num).length}
                              {@const tooltip = planetsTooltip(primaryProjectedPlanets, row.num, natalPointMeta)}
                              <span class="house-proj-icons" title={tooltip} aria-label={tooltip}>
                                {planetsIcons(primaryProjectedPlanets, row.num, natalPointMeta)}
                              </span>
                            {:else}
                              —
                            {/if}
                          </td>
                        {/if}
                        <td class="py-2 pr-3">
                          <span style={`color:${row.elementColor}`}>{row.elementIcon} {row.element || '—'}</span>
                        </td>
                        <td class="py-2 pr-3">{row.qualityIcon} {row.quality || '—'}</td>
                        <td class="py-2 pr-3">{row.degree || '—'}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <p class="text-sm text-slate-400">No houses returned.</p>
            {/if}
          </div>
        </div>

        {#if (natalPointRows.length || natalHouseRows.length) && subjects.natal}
          <div class="space-y-5">
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <span class="subject-badge" style={`--badge:${secondaryAccent};`}>{subjects.natal?.name || 'Subject 2'}</span>
                <CardHeader label="Points" badge={natalPointRows.length} />
              </div>
              {#if natalPointRows.length}
                <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                  <thead class="text-slate-400">
                    <tr>
                      <th class="py-2 pr-3 text-left">Body</th>
                      <th class="py-2 pr-3 text-left">Sign</th>
                      <th class="py-2 pr-3 text-left">Element</th>
                      <th class="py-2 pr-3 text-left">Quality</th>
                      <th class="py-2 pr-3 text-left">Degree</th>
                      <th class="py-2 pr-3 text-left">House</th>
                      <th class="py-2 pr-3 text-left">Retro</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    {#each natalPointRows as row}
                      <tr>
                          <td class="py-2 pr-3">{row.icon} {row.label}</td>
                          <td class="py-2 pr-3" style={`color:${row.elementColor}`}>{row.sign} {row.signIcon}</td>
                          <td class="py-2 pr-3">
                            <span style={`color:${row.elementColor}`}>{row.elementIcon} {row.element || '—'}</span>
                          </td>
                          <td class="py-2 pr-3">{row.qualityIcon} {row.quality || '—'}</td>
                          <td class="py-2 pr-3">{row.degree || '—'}</td>
                          <td class="py-2 pr-3">{row.house || '—'}</td>
                          <td class="py-2 pr-3">{row.retro || '—'}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}
                <p class="text-sm text-slate-400">No points returned.</p>
              {/if}
            </div>

            <div class="space-y-3">
              {#if natalHouseRows.length}
                <div class="overflow-x-auto">
                  <table class="min-w-full text-sm">
                    <thead class="text-slate-400">
                      <tr>
                        <th class="py-2 pr-3 text-left">House</th>
                        <th class="py-2 pr-3 text-left">Sign</th>
                        <th class="py-2 pr-3 text-left">Planets</th>
                        {#if showNatalProjectedColumn}
                          <th class="py-2 pr-3 text-left">Projected</th>
                        {/if}
                        <th class="py-2 pr-3 text-left">Element</th>
                        <th class="py-2 pr-3 text-left">Quality</th>
                        <th class="py-2 pr-3 text-left">Degree</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800">
                      {#each natalHouseRows as row}
                        <tr>
                          <td class="py-2 pr-3">{row.label}</td>
                          <td class="py-2 pr-3" style={`color:${row.elementColor}`}>{row.sign} {row.signIcon}</td>
                          <td class="py-2 pr-3">
                            {#if planetsForHouse(natalOwnPlanets, row.num).length}
                              {@const tooltip = planetsTooltip(natalOwnPlanets, row.num, natalPointMeta)}
                              <span class="house-proj-icons" title={tooltip} aria-label={tooltip}>
                                {planetsIcons(natalOwnPlanets, row.num, natalPointMeta)}
                              </span>
                            {:else}
                              —
                            {/if}
                          </td>
                          {#if showNatalProjectedColumn}
                            <td class="py-2 pr-3">
                              {#if planetsForHouse(natalProjectedPlanets, row.num).length}
                                {@const tooltip = planetsTooltip(natalProjectedPlanets, row.num, primaryPointMeta)}
                                <span class="house-proj-icons" title={tooltip} aria-label={tooltip}>
                                  {planetsIcons(natalProjectedPlanets, row.num, primaryPointMeta)}
                                </span>
                              {:else}
                                —
                              {/if}
                            </td>
                          {/if}
                          <td class="py-2 pr-3">
                            <span style={`color:${row.elementColor}`}>{row.elementIcon} {row.element || '—'}</span>
                          </td>
                          <td class="py-2 pr-3">{row.qualityIcon} {row.quality || '—'}</td>
                          <td class="py-2 pr-3">{row.degree || '—'}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .subject-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #e2f3ff;
    background: color-mix(in srgb, var(--badge, #22d3ee) 32%, rgba(15, 23, 42, 0.85));
    border: 1px solid color-mix(in srgb, var(--badge, #22d3ee) 45%, rgba(255, 255, 255, 0.1));
  }

  .house-proj-icons {
    letter-spacing: 0.08em;
    white-space: nowrap;
    cursor: default;
  }
</style>
