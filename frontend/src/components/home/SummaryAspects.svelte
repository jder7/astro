<script>
  export let topAspects = [];
</script>

<div class="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-2">
  <div class="flex items-center justify-between">
    <p class="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80 font-semibold">Top aspects</p>
    <span class="badge">{topAspects.length}</span>
  </div>
  {#if topAspects.length}
    <div class="space-y-2">
      {#each topAspects as aspect}
        <div class="flex items-center gap-2 text-sm text-slate-100">
          <span class="text-xs text-slate-400">{aspect.label}</span>
          <span class="font-semibold">{aspect.text}</span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-slate-400">Generate a chart to see the top 7 aspects.</p>
  {/if}
</div>
