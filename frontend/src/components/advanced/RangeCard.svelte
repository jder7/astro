<script>
  import RangeSummary from '$components/output/RangeSummary.svelte';

  export let rangeResult = null;
  export let summary = { ranges: [] };

  $: ranges = (rangeResult?.ranges && rangeResult.ranges.length ? rangeResult.ranges : summary.ranges) || [];
  $: count = rangeResult?.snapshots?.length || ranges.length || 0;
</script>

<div class="glass-card p-4 space-y-3">
  <div class="flex items-center justify-between">
    <p class="section-title text-xs">Transit range</p>
    <span class="badge">{count}</span>
  </div>
  {#if ranges.length}
    <p class="text-sm text-slate-300">Ascendant, moon, and sun sweeps from the selected range.</p>
    <RangeSummary ranges={ranges} />
  {:else}
    <p class="text-sm text-slate-400">Run a range request to see sweeps and snapshots.</p>
  {/if}
</div>
