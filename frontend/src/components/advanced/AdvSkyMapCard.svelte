<script>
  import { formatDegree } from '$lib/astro/format';
  import { collectPoints, extractSubjects, formatHouseName } from '$lib/astro/advanced';
  import { POINT_SYMBOLS, signName, signSymbol } from '$lib/astro/signs';
  import CardHeader from '$components/shared/CardHeader.svelte';

  export let response = null;
  let collapsed = false;

  const shapePoint = ([key, point]) => ({
    key,
    label: point.name || key,
    icon: POINT_SYMBOLS[key] || '★',
    sign: signName(point.sign),
    signIcon: signSymbol(point.sign),
    element: point.element || '',
    quality: point.quality || '',
    degree: Number.isFinite(point.position) ? formatDegree(point.position) : '',
    house: formatHouseName(point.house),
  });

  const shapeHouse = ([key, house]) => ({
    key,
    label: formatHouseName(house.house || house.name || key),
    sign: signName(house.sign),
    signIcon: signSymbol(house.sign),
    element: house.element || '',
    quality: house.quality || '',
    degree: Number.isFinite(house.position) ? formatDegree(house.position) : '',
  });

  $: subjects = extractSubjects(response);
  $: primaryPoints = collectPoints(subjects.primary || {});
  $: natalPoints = collectPoints(subjects.natal || {});
  $: pointRows = Object.entries(primaryPoints.points || {}).map(shapePoint);
  $: houseRows = Object.entries(primaryPoints.houses || {}).map(shapeHouse);
  $: natalPointRows = Object.entries(natalPoints.points || {}).map(shapePoint);
  $: natalHouseRows = Object.entries(natalPoints.houses || {}).map(shapeHouse);
</script>

<div class="flowbite-card space-y-4">
  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Sky map</p>
      <h2>Points &amp; Houses</h2>
    </div>
    <button
      type="button"
      class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition"
      on:click={() => (collapsed = !collapsed)}
      aria-expanded={!collapsed}
      aria-controls="adv-skymap-panel"
    >
      <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
      </svg>
    </button>
  </div>

  {#if !collapsed}
    <div id="adv-skymap-panel" class="space-y-4">
      {#if !response}
        <p class="text-sm text-slate-400">Generate a chart to see point and house placements.</p>
      {:else}
        <div class="space-y-3">
          <CardHeader label="Points" badge={pointRows.length} />
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
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  {#each pointRows as row}
                    <tr>
                      <td class="py-2 pr-3">{row.icon} {row.label}</td>
                      <td class="py-2 pr-3">{row.sign} {row.signIcon}</td>
                      <td class="py-2 pr-3">{row.element || '—'}</td>
                      <td class="py-2 pr-3">{row.quality || '—'}</td>
                      <td class="py-2 pr-3">{row.degree || '—'}</td>
                      <td class="py-2 pr-3">{row.house || '—'}</td>
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
          <CardHeader label="Houses" badge={houseRows.length} />
          {#if houseRows.length}
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="text-slate-400">
                  <tr>
                    <th class="py-2 pr-3 text-left">House</th>
                    <th class="py-2 pr-3 text-left">Sign</th>
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
                      <td class="py-2 pr-3">{row.element || '—'}</td>
                      <td class="py-2 pr-3">{row.quality || '—'}</td>
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

        {#if natalPointRows.length || natalHouseRows.length}
          <div class="space-y-3">
          <CardHeader label="Natal overlay" badge={natalPointRows.length + natalHouseRows.length} />
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
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    {#each natalPointRows as row}
                      <tr>
                        <td class="py-2 pr-3">{row.icon} {row.label}</td>
                        <td class="py-2 pr-3">{row.sign} {row.signIcon}</td>
                        <td class="py-2 pr-3">{row.element || '—'}</td>
                        <td class="py-2 pr-3">{row.quality || '—'}</td>
                        <td class="py-2 pr-3">{row.degree || '—'}</td>
                        <td class="py-2 pr-3">{row.house || '—'}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}

            {#if natalHouseRows.length}
              <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                  <thead class="text-slate-400">
                    <tr>
                      <th class="py-2 pr-3 text-left">House</th>
                      <th class="py-2 pr-3 text-left">Sign</th>
                      <th class="py-2 pr-3 text-left">Element</th>
                      <th class="py-2 pr-3 text-left">Quality</th>
                      <th class="py-2 pr-3 text-left">Degree</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    {#each natalHouseRows as row}
                      <tr>
                        <td class="py-2 pr-3">{row.label}</td>
                        <td class="py-2 pr-3">{row.sign} {row.signIcon}</td>
                        <td class="py-2 pr-3">{row.element || '—'}</td>
                        <td class="py-2 pr-3">{row.quality || '—'}</td>
                        <td class="py-2 pr-3">{row.degree || '—'}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
