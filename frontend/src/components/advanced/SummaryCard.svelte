<script>
  import SummarySection from '$components/output/SummarySection.svelte';
  import RangeSummary from '$components/output/RangeSummary.svelte';

  export let summary = { sections: [], ranges: [] };
</script>

<div class="glass-card p-4 space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <p class="section-title text-xs">Summary</p>
      <p class="text-sm text-slate-300">Key points and ranges</p>
    </div>
    <span class="badge">{(summary.sections || []).length || 0} sections</span>
  </div>

  {#if summary.sections && summary.sections.length}
    <div class="space-y-4">
      {#each summary.sections as section}
        <SummarySection {section} />
      {/each}
    </div>
  {:else}
    <p class="text-sm text-slate-400">Generate a chart to see the breakdown.</p>
  {/if}

  {#if summary.ranges && summary.ranges.length}
    <RangeSummary ranges={summary.ranges} />
  {/if}
</div>
