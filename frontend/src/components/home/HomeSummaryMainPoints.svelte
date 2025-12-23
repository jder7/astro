<script>
  import { signSymbol, signName, POINT_SYMBOLS } from '$lib/astro/signs';

  export let summary = { sections: [], points: [] };

  const order = ['Sun', 'Moon', 'Ascendant'];

  $: mainPointMap = (() => {
    const map = new Map();
    const section = (summary.sections || [])[0];
    (section?.points || []).forEach((p) => {
      const key = (p.label || '').toLowerCase();
      if (key) map.set(key, p);
    });
    return map;
  })();
</script>

<div class="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-2">
  <p class="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80 font-semibold">Sun · Moon · Asc</p>
  {#if mainPointMap.size}
    <div class="space-y-2">
      {#each order as target}
        {@const point = mainPointMap.get(target.toLowerCase())}
        {#if point}
          <div class="flex flex-wrap items-start gap-2 text-sm font-semibold text-slate-100 min-w-0">
            <span aria-hidden="true">{point.icon || POINT_SYMBOLS[target.toLowerCase()] || '★'}</span>
            <span class="min-w-0 break-words">{point.label || target} · in {signName(point.sign)} {signSymbol(point.sign)} · @ {point.degree || '—'}</span>
          </div>
        {/if}
      {/each}
    </div>
  {:else}
    <p class="text-sm text-slate-400">Generate a chart to see Sun, Moon, and Ascendant.</p>
  {/if}
</div>
