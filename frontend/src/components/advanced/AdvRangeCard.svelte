<script>
  import { collectPoints } from '$lib/astro/advanced';
  import { formatDateLabel, formatDateShort, toDate } from '$lib/astro/format';
  import { POINT_SYMBOLS, signName, signSymbol } from '$lib/astro/signs';
  import RangeForm from '$components/workbench/RangeForm.svelte';

  export let rangeResult = null;
  export let mode = 'natal';
  export let onRange = null;
  export let loading = false;

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
    {#if rangeResult?.granularity}
      <span class="badge">Step: {rangeResult.granularity}</span>
    {:else}
      <span class="badge capitalize">{mode}</span>
    {/if}
  </div>

  <RangeForm on:range={onRange} {loading} />

  <p id="adv-range-summary" class="text-sm text-slate-200">{summaryLine}</p>

  <div id="adv-range-results" class="space-y-3">
    {#if entries.length}
      {#each entries as entry}
        <div class="compact-row">
          <div>
            <p class="compact-label">{entry.label}</p>
            <p class="compact-value">{entry.time || '—'}</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
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
        </div>
      {/each}
    {:else}
      <p class="text-sm text-slate-400">Pick a window and tap Visualize to see each stop along the way.</p>
    {/if}
  </div>
</div>
