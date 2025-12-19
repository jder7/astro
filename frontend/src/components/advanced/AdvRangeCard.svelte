<script>
  import { collectPoints } from '$lib/astro/advanced';
  import { formatDateLabel, formatDateShort, toDate } from '$lib/astro/format';
  import { POINT_SYMBOLS, signName, signSymbol } from '$lib/astro/signs';
  import RangeForm from '$components/workbench/RangeForm.svelte';
  import CardHeader from '$components/shared/CardHeader.svelte';

  export let rangeResult = null;
  export let mode = 'natal';
  export let onRange = null;
  export let loading = false;
  let collapsed = false;

  const formatSnapshot = (snap) => {
    const ts = toDate(snap?.timestamp);
    const label = ts ? formatDateShort(ts) : 'Snapshot';
    const time = ts ? formatDateLabel(ts) : '';
    const { points } = collectPoints(snap?.subject || {});
    const placements = ['sun', 'moon', 'ascendant']
      .map((key) => {
        const pt = points[key];
        if (!pt) return null;
        return {
          key,
          icon: POINT_SYMBOLS[key] || '★',
          sign: signName(pt.sign),
          signIcon: signSymbol(pt.sign),
        };
      })
      .filter(Boolean);
    return { label, time, placements };
  };

  $: snapshots = Array.isArray(rangeResult?.snapshots) ? rangeResult.snapshots : [];
  $: ordered = snapshots
    .slice()
    .sort((a, b) => {
      const at = toDate(a?.timestamp)?.getTime() || 0;
      const bt = toDate(b?.timestamp)?.getTime() || 0;
      return at - bt;
    });
  $: startDate = ordered[0]?.timestamp ? toDate(ordered[0].timestamp) : null;
  $: endDate = ordered.length && ordered[ordered.length - 1]?.timestamp ? toDate(ordered[ordered.length - 1].timestamp) : null;
  $: startLabel = startDate ? formatDateShort(startDate) : '—';
  $: endLabel = endDate ? formatDateShort(endDate) : '—';
  $: summaryLine = ordered.length
    ? `${startLabel} → ${endLabel} (${ordered.length} snapshots)`
    : 'Set start and end to see duration.';
  $: entries = ordered.map(formatSnapshot);
</script>

<div class="flowbite-card space-y-4" id="adv-range-panel">
  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Future vision</p>
      <h2>Range explorer</h2>
      <p class="text-xs text-slate-400">Transit and dual modes only.</p>
    </div>
    <div class="flex items-center gap-2">
      {#if rangeResult?.granularity}
        <span class="badge">Step: {rangeResult.granularity}</span>
      {:else}
        <span class="badge capitalize">{mode}</span>
      {/if}
      <button
        type="button"
        class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition"
        on:click={() => (collapsed = !collapsed)}
        aria-expanded={!collapsed}
        aria-controls="adv-range-panel-body"
      >
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
        </svg>
      </button>
    </div>
  </div>

  {#if !collapsed}
    <div id="adv-range-panel-body" class="space-y-4">
      <RangeForm on:range={onRange} {loading} />

      <p id="adv-range-summary" class="text-sm text-slate-200">{summaryLine}</p>

      <div id="adv-range-results" class="space-y-3">
        {#if entries.length}
          {#each entries as entry}
            <CardHeader label={entry.label} value={entry.time || '—'}>
              <svelte:fragment slot="right">
                <div class="flex items-center gap-2 flex-wrap justify-end">
                  {#each entry.placements as placement}
                    <span class="badge">
                      <span aria-hidden="true">{placement.icon}</span>
                      {placement.sign}
                      {#if placement.signIcon}
                        <span aria-hidden="true">{placement.signIcon}</span>
                      {/if}
                    </span>
                  {/each}
                </div>
              </svelte:fragment>
            </CardHeader>
          {/each}
        {:else}
          <p class="text-sm text-slate-400">Pick a window and tap Visualize to see each stop along the way.</p>
        {/if}
      </div>
    </div>
  {/if}
</div>
