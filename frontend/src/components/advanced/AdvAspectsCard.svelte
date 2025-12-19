<script>
  import { get } from 'svelte/store';
  import MajorAspectIcon from '$components/shared/MajorAspectIcon.svelte';
  import AdvAspectMatrix from '$components/advanced/AdvAspectMatrix.svelte';
  import CardHeader from '$components/shared/CardHeader.svelte';
  import { extractAspects } from '$lib/astro/advanced';
  import { configStore } from '$lib/state/configStore';
  import { POINT_SYMBOLS } from '$lib/astro/signs';

  export let response = null;
  export let mode = 'natal';
  let collapsed = false;

  const normalizeLabel = (label) => String(label || '').trim().replace(/\s+/g, '_').toLowerCase();

  const formatPatternParts = (pattern) => {
    if (!pattern) return { name: 'Pattern', detail: '' };
    const name = pattern.name || pattern.id || pattern.geometry || 'Pattern';
    const points = Array.isArray(pattern.points) ? pattern.points.join(', ') : '';
    const desc = pattern.geometry || pattern.aspects_label || pattern.aspectsLabel || pattern.planets || '';
    return { name, detail: [points, desc].filter(Boolean).join(' · ') };
  };

  $: aspectData = extractAspects(response || {});
  $: aspects = aspectData.aspects || [];
  $: natalAspects = aspectData.natalAspects || [];
  $: majorAspects = aspectData.majorAspects || [];
  $: natalMajorAspects = aspectData.natalMajorAspects || [];
  $: activeSet = new Set((get(configStore).active_points || []).map((point) => normalizeLabel(point)));

  const filterAspectsByActive = (entries) =>
    (entries || []).filter((aspect) => {
      if (!aspect || !activeSet.size) return Boolean(aspect);
      const leftKey = normalizeLabel(aspect.left);
      const rightKey = normalizeLabel(aspect.right);
      if (!leftKey || !rightKey) return false;
      return activeSet.has(leftKey) && activeSet.has(rightKey);
    });

  $: filteredAspects = filterAspectsByActive(aspects);
  $: filteredNatalAspects = filterAspectsByActive(natalAspects);

  const formatAspectRow = (entry) => {
    if (!entry) return null;
    const base = entry.left || '—';
    const other = entry.right || '—';
    const baseIcon = POINT_SYMBOLS[normalizeLabel(base)] || '';
    const otherIcon = POINT_SYMBOLS[normalizeLabel(other)] || '';
    const aspectLabel = entry.name || entry.aspect || 'Aspect';
    const orb =
      typeof entry.orb === 'number'
        ? `${entry.orb.toFixed(2)}°`
        : typeof entry.orb === 'string' && entry.orb.includes('°')
          ? entry.orb
          : entry.orb
            ? `${entry.orb}°`
            : '';
    const orbValue =
      typeof entry.orb === 'number'
        ? entry.orb
        : Number.parseFloat(String(entry.orb || '').replace('°', ''));
    return {
      baseIcon,
      base,
      otherIcon,
      other,
      aspect: aspectLabel,
      orb: orb || '—',
      orbValue: Number.isFinite(orbValue) ? orbValue : Number.POSITIVE_INFINITY,
    };
  };

  const sortBy = (rows, column, direction) => {
    const dir = direction === 'desc' ? -1 : 1;
    return rows.slice().sort((a, b) => {
      if (!a || !b) return 0;
      if (column === 'orb') {
        return (a.orbValue - b.orbValue) * dir;
      }
      return String(a[column] || '').localeCompare(String(b[column] || '')) * dir;
    });
  };

  let sortState = { column: 'orb', direction: 'asc' };

  const onSort = (column) => {
    sortState =
      sortState.column === column
        ? { column, direction: sortState.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' };
  };

  $: currentRows = sortBy(filteredAspects.map(formatAspectRow).filter(Boolean), sortState.column, sortState.direction);
  $: natalRows = sortBy(filteredNatalAspects.map(formatAspectRow).filter(Boolean), sortState.column, sortState.direction);
</script>

<div class="flowbite-card space-y-4">
  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Synthesis</p>
      <h2>Aspects Summary</h2>
    </div>
    <div class="flex items-center gap-2">
      {#if response}
        <span class="badge capitalize">{mode}</span>
      {/if}
      <button
        type="button"
        class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition"
        on:click={() => (collapsed = !collapsed)}
        aria-expanded={!collapsed}
        aria-controls="adv-aspects-panel"
      >
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
        </svg>
      </button>
    </div>
  </div>

  {#if !collapsed}
    <div id="adv-aspects-panel" class="space-y-4">
      {#if !response}
        <p class="text-sm text-slate-400">Generate any mode to view aspects and configurations.</p>
      {:else}
        <div class="space-y-4">
          <AdvAspectMatrix {response} mode={mode} />

          <div id="adv-aspects-major-configs" class="space-y-2">
            <CardHeader label="Major configurations" badge={majorAspects.length + natalMajorAspects.length} />
            {#if majorAspects.length}
              <div class="space-y-1">
                <p class="text-xs text-slate-400">Current chart</p>
                <ul id="adv-aspects-major-current" class="space-y-2 text-sm text-slate-200">
                  {#each majorAspects as pattern}
                    {@const parts = formatPatternParts(pattern)}
                    <li class="flex items-start gap-2">
                      <MajorAspectIcon patternId={pattern.id || 'generic'} size={24} />
                      <div>
                        <p class="text-sm text-slate-200">{parts.name}</p>
                        {#if parts.detail}
                          <p class="text-xs text-slate-400">{parts.detail}</p>
                        {/if}
                      </div>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if natalMajorAspects.length}
              <div class="space-y-1">
                <p class="text-xs text-slate-400">Natal</p>
                <ul id="adv-aspects-major-natal" class="space-y-2 text-sm text-slate-200">
                  {#each natalMajorAspects as pattern}
                    {@const parts = formatPatternParts(pattern)}
                    <li class="flex items-start gap-2">
                      <MajorAspectIcon patternId={pattern.id || 'generic'} size={24} />
                      <div>
                        <p class="text-sm text-slate-200">{parts.name}</p>
                        {#if parts.detail}
                          <p class="text-xs text-slate-400">{parts.detail}</p>
                        {/if}
                      </div>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if !majorAspects.length && !natalMajorAspects.length}
              <p class="text-sm text-slate-400">No pattern matches returned.</p>
            {/if}
          </div>

          <CardHeader label="Aspects" badge={filteredAspects.length + filteredNatalAspects.length} />

          {#if currentRows.length}
            <div class="overflow-x-auto">
              <table class="w-full text-sm min-w-[520px]" id="adv-aspects-current-table">
                <thead class="text-xs text-slate-400">
                  <tr>
                    <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('base')}>Base</th>
                    <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('aspect')}>Aspect</th>
                    <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('other')}>Other</th>
                    <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('orb')}>Orb</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  {#each currentRows as aspect}
                    <tr>
                      <td class="py-2 pr-3 whitespace-nowrap">{aspect.baseIcon} {aspect.base}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{aspect.aspect}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{aspect.otherIcon} {aspect.other}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{aspect.orb}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}

          {#if natalRows.length}
            <div class="space-y-2">
              <p class="text-xs text-slate-400">Natal</p>
              <div class="overflow-x-auto">
                <table class="w-full text-sm min-w-[520px]" id="adv-aspects-natal-table">
                  <thead class="text-xs text-slate-400">
                    <tr>
                      <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('base')}>Base</th>
                      <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('aspect')}>Aspect</th>
                      <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('other')}>Other</th>
                      <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('orb')}>Orb</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    {#each natalRows as aspect}
                      <tr>
                        <td class="py-2 pr-3 whitespace-nowrap">{aspect.baseIcon} {aspect.base}</td>
                        <td class="py-2 pr-3 whitespace-nowrap">{aspect.aspect}</td>
                        <td class="py-2 pr-3 whitespace-nowrap">{aspect.otherIcon} {aspect.other}</td>
                        <td class="py-2 pr-3 whitespace-nowrap">{aspect.orb}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/if}

          {#if !filteredAspects.length && !filteredNatalAspects.length}
            <p class="text-sm text-slate-400">No aspects found for the current active points.</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
