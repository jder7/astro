<script>
  import AspectsList from '$components/output/AspectsList.svelte';

  export let summary = { aspects: [] };
</script>

<div class="glass-card p-4 space-y-3">
  <div class="flex items-center justify-between">
    <p class="section-title text-xs">Aspects</p>
    <span class="badge">{(summary.aspects || []).length || 0}</span>
  </div>
  {#if summary.aspects && summary.aspects.length}
    <AspectsList aspects={summary.aspects} />
  {:else}
    <p class="text-sm text-slate-400">Generate a chart to see aspects.</p>
  {/if}
</div>
