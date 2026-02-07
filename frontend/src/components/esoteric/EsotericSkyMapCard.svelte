<script>
  import { formatDegree, formatOrdinal } from '$lib/astro/format';
  import { collectPoints, extractSubjects, formatHouseName } from '$lib/astro/advanced';
  import { ELEMENT_HEX, POINT_SYMBOLS, signName, signSymbol } from '$lib/astro/signs';
  import { getRayColorHex, getSignEssentialQuality, getSignRays } from '$lib/astro/rays';
  import { EsotericRaySpectrumUtils } from '$lib/astro/esotericRaySpectrumUtils';
  import { configStore } from '$lib/state/configStore';
  import CardHeader from '$components/shared/CardHeader.svelte';
  import EsotericRayConfigPanel from '$components/esoteric/EsotericRayConfigPanel.svelte';
  import EsotericRaySpectrum from '$components/esoteric/EsotericRaySpectrum.svelte';
  import ConfigIcon from '$components/visual/ConfigIcon.svelte';

  export let response = null;
  export let mode = 'natal';
  let collapsed = true;
  let rayState = 'personality';
  let showRayConfig = false;
  let enablePointRays = false;
  let overtoneCoeff = 0.2;
  let dayRulerWeight = 3;
  let sunPointWeight = 5;
  let moonPointWeight = 3;
  let ascendantPointWeight = 7;
  let aspectWeightTight = EsotericRaySpectrumUtils.DEFAULT_ORB_WEIGHTS.tight;
  let aspectWeightClose = EsotericRaySpectrumUtils.DEFAULT_ORB_WEIGHTS.close;
  let aspectWeightWide = EsotericRaySpectrumUtils.DEFAULT_ORB_WEIGHTS.wide;
  let aspectWeightLoose = EsotericRaySpectrumUtils.DEFAULT_ORB_WEIGHTS.loose;

  const STATE_OPTIONS = [
    { value: 'physical', label: 'Physical (Decan 1)' },
    { value: 'emotional', label: 'Emotional (Decan 2)' },
    { value: 'mental', label: 'Mental (Decan 3)' },
    { value: 'personality', label: 'Personality (All decans)' },
  ];

  const STATE_CLASSES = {
    physical: 'eso-decan-physical',
    emotional: 'eso-decan-emotional',
    mental: 'eso-decan-mental',
    personality: 'eso-decan-personality',
  };

  const normalizePointKey = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]+/g, '');

  const filterPointsByActive = (points, activeSet) => {
    if (!points || typeof points !== 'object' || !activeSet || !activeSet.size) return points || {};
    return Object.fromEntries(Object.entries(points).filter(([key]) => activeSet.has(normalizePointKey(key))));
  };

  const shapePoint = ([key, point]) => {
    const retro = point?.retrograde ? 'Rx' : '';
    const elementColor = ELEMENT_HEX[point.element] || ELEMENT_HEX.Default;
    const signLabel = signName(point.sign);
    const rays = getSignRays(signLabel);
    return {
      key,
      label: point.name || key,
      icon: POINT_SYMBOLS[key] || '★',
      sign: signLabel,
      signIcon: signSymbol(point.sign),
      degree: Number.isFinite(point.position) ? formatDegree(point.position) : '',
      house: formatHouseName(point.house),
      retro,
      elementColor,
      rays,
      essential: getSignEssentialQuality(signLabel),
    };
  };


  $: subjects = extractSubjects(response, mode);
  $: primaryPoints = collectPoints(subjects.primary || {});
  $: natalPoints = collectPoints(subjects.natal || {});
  $: activeSet = new Set(($configStore?.active_points || []).map(normalizePointKey));
  $: filteredPrimaryPoints = filterPointsByActive(primaryPoints.points, activeSet);
  $: pointRows = Object.entries(filteredPrimaryPoints || {}).map(shapePoint);
  $: filteredNatalPoints = filterPointsByActive(natalPoints.points, activeSet);
  $: natalPointRows = Object.entries(filteredNatalPoints || {}).map(shapePoint);
  $: hasSecondarySubject = Boolean(subjects.natal);
  $: stateLabel = STATE_OPTIONS.find((opt) => opt.value === rayState)?.label || 'State';

  const primaryAccent = '#22d3ee';
  const secondaryAccent = '#c084fc';
</script>

<div class="flowbite-card space-y-4">
  <div class="card-head card-head-inline">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Sky map</p>
      <h2>Points</h2>
    </div>
    <div class="card-head-actions">
      <button
        type="button"
        class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition"
        on:click={() => (collapsed = !collapsed)}
        aria-expanded={!collapsed}
        aria-controls="eso-skymap-panel"
        aria-label={collapsed ? 'Expand sky map panel' : 'Collapse sky map panel'}
      >
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
        </svg>
      </button>
    </div>
  </div>

  {#if !collapsed}
    <div id="eso-skymap-panel" class="space-y-4">
      {#if !response}
        <p class="text-sm text-slate-400">Generate a chart to see point and house placements.</p>
      {:else}
        <div class="space-y-5">
          <div class="space-y-3">
            <div class="eso-ray-controls">
              <div class="eso-ray-control">
                <label for="eso-ray-state">State</label>
                <select id="eso-ray-state" bind:value={rayState}>
                  {#each STATE_OPTIONS as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </div>
              <div class="eso-ray-actions">
                <span class={`eso-state-pill ${STATE_CLASSES[rayState]}`}>{stateLabel}</span>
                <button
                  type="button"
                  class="icon-button"
                  aria-label={showRayConfig ? 'Hide ray spectrum settings' : 'Show ray spectrum settings'}
                  aria-expanded={showRayConfig}
                  aria-controls="eso-ray-config"
                  on:click={() => (showRayConfig = !showRayConfig)}
                >
                  <ConfigIcon />
                </button>
              </div>
            </div>

            {#if showRayConfig}
              <EsotericRayConfigPanel
                bind:enablePointRays
                bind:overtoneCoeff
                bind:dayRulerWeight
                bind:sunPointWeight
                bind:moonPointWeight
                bind:ascendantPointWeight
                bind:aspectWeightTight
                bind:aspectWeightClose
                bind:aspectWeightWide
                bind:aspectWeightLoose
              />
            {/if}

            <EsotericRaySpectrum
              response={response}
              mode={mode}
              state={rayState}
              {enablePointRays}
              {overtoneCoeff}
              {dayRulerWeight}
              {sunPointWeight}
              {moonPointWeight}
              {ascendantPointWeight}
              {aspectWeightTight}
              {aspectWeightClose}
              {aspectWeightWide}
              {aspectWeightLoose}
            />
          </div>

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
                      <th class="py-2 pr-3 text-left">Sign Rays</th>
                      <th class="py-2 pr-3 text-left">Degree</th>
                      <th class="py-2 pr-3 text-left">House</th>
                      <th class="py-2 pr-3 text-left">Retro</th>
                      <th class="py-2 pr-3 text-left">Essential quality</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    {#each pointRows as row}
                      <tr>
                        <td class="py-2 pr-3">{row.icon} {row.label}</td>
                        <td class="py-2 pr-3">
                          <span style={`color:${row.rays?.length ? getRayColorHex(row.rays[0]) : row.elementColor}`}>
                            {row.sign} {row.signIcon}
                          </span>
                        </td>
                        <td class="py-2 pr-3">
                          {#if row.rays?.length}
                            {#each row.rays as ray, idx}
                              <span style={`color:${getRayColorHex(ray)}`}>{formatOrdinal(ray)}</span>{idx < row.rays.length - 1 ? ', ' : ''}
                            {/each}
                          {:else}
                            <span class="text-slate-500">—</span>
                          {/if}
                        </td>
                        <td class="py-2 pr-3">{row.degree || '—'}</td>
                        <td class="py-2 pr-3">{row.house || '—'}</td>
                        <td class="py-2 pr-3">{row.retro || '—'}</td>
                        <td class="py-2 pr-3">{row.essential || '—'}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <p class="text-sm text-slate-400">No points returned.</p>
            {/if}
          </div>

          {#if mode === 'natal_transit' || mode === 'relationship'}
            {#if natalPointRows.length}
              <div class="space-y-3">
                <div class="flex items-center gap-2">
                  <span class="subject-badge" style={`--badge:${secondaryAccent};`}>
                    {subjects.natal?.name || (mode === 'relationship' ? 'Subject 2' : 'Natal')}
                  </span>
                  <CardHeader label="Points" badge={natalPointRows.length} />
                </div>
                {#if natalPointRows.length}
                  <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                      <thead class="text-slate-400">
                        <tr>
                          <th class="py-2 pr-3 text-left">Body</th>
                          <th class="py-2 pr-3 text-left">Sign</th>
                          <th class="py-2 pr-3 text-left">Sign Rays</th>
                          <th class="py-2 pr-3 text-left">Degree</th>
                          <th class="py-2 pr-3 text-left">House</th>
                          <th class="py-2 pr-3 text-left">Retro</th>
                          <th class="py-2 pr-3 text-left">Essential quality</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-800">
                        {#each natalPointRows as row}
                          <tr>
                            <td class="py-2 pr-3">{row.icon} {row.label}</td>
                            <td class="py-2 pr-3">
                              <span style={`color:${row.rays?.length ? getRayColorHex(row.rays[0]) : row.elementColor}`}>
                                {row.sign} {row.signIcon}
                              </span>
                            </td>
                            <td class="py-2 pr-3">
                              {#if row.rays?.length}
                                {#each row.rays as ray, idx}
                                  <span style={`color:${getRayColorHex(ray)}`}>{formatOrdinal(ray)}</span>{idx < row.rays.length - 1 ? ', ' : ''}
                                {/each}
                              {:else}
                                <span class="text-slate-500">—</span>
                              {/if}
                            </td>
                            <td class="py-2 pr-3">{row.degree || '—'}</td>
                            <td class="py-2 pr-3">{row.house || '—'}</td>
                            <td class="py-2 pr-3">{row.retro || '—'}</td>
                            <td class="py-2 pr-3">{row.essential || '—'}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {:else}
                  <p class="text-sm text-slate-400">No points returned.</p>
                {/if}
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .eso-ray-controls {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
  }

  .eso-ray-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .eso-ray-control {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 180px;
  }

  .eso-ray-control label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(148, 163, 184, 0.8);
    font-weight: 600;
  }

  .eso-ray-control select {
    padding: 0.35rem 0.55rem;
    border-radius: 10px;
    border: 1px solid rgba(20, 83, 45, 0.65);
    background: rgba(7, 28, 19, 0.8);
    color: #e2f7ee;
    font-size: 0.85rem;
  }

  .eso-state-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0.7rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1px solid rgba(34, 197, 94, 0.35);
    min-height: 32px;
    white-space: nowrap;
  }

  .eso-decan-physical {
    background: rgba(34, 197, 94, 0.18);
    color: #bbf7d0;
  }

  .eso-decan-emotional {
    background: rgba(59, 130, 246, 0.18);
    color: #bfdbfe;
  }

  .eso-decan-mental {
    background: rgba(192, 132, 252, 0.2);
    color: #e9d5ff;
  }

  .eso-decan-personality {
    background: rgba(74, 222, 128, 0.18);
    color: #bbf7d0;
  }

</style>
