<script>
  export let mainPoints = [];
</script>

<div class="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-2">
  <p class="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80 font-semibold">Sun · Moon · Asc</p>
  {#if mainPoints.length}
    <div class="space-y-2">
      {#each mainPoints as point}
        <div class="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <span aria-hidden="true">{point.icon}</span>
          <span>{point.text}</span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-slate-400">Generate a chart to see Sun, Moon, and Ascendant.</p>
  {/if}
</div>
