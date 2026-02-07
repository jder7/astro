<script>
  import { signSymbol, signName, POINT_SYMBOLS } from '$lib/astro/signs';
  import HomeSummaryMoonCycle from './HomeSummaryMoonCycle.svelte';

  export let summary = { sections: [], points: [] };
  export let mode = 'natal';
  export let birthParts = null;
  export let transitParts = null;

  const order = ['Sun', 'Moon', 'Ascendant'];

  $: resolvedBirthParts = birthParts || summary?.context?.birthParts || null;
  $: resolvedTransitParts = transitParts || summary?.context?.transitParts || null;

  const resolvePartsForSection = (section) => {
    const contextKey = section?.meta?.contextKey;
    if (contextKey === 'transit') return resolvedTransitParts || summary.context?.transitParts || null;
    if (contextKey === 'birth') return resolvedBirthParts || summary.context?.birthParts || null;
    if (contextKey === 'first') return summary.context?.firstParts || null;
    if (contextKey === 'second') return summary.context?.secondParts || null;
    const title = String(section?.meta?.title || '').toLowerCase();
    if (title.includes('transit')) return resolvedTransitParts || summary.context?.transitParts || null;
    if (title.includes('natal')) return resolvedBirthParts || summary.context?.birthParts || null;
    if (title.includes('partner a')) return summary.context?.firstParts || null;
    if (title.includes('partner b')) return summary.context?.secondParts || null;
    if (mode === 'natal_transit') return resolvedBirthParts || summary.context?.birthParts || null;
    if (mode === 'transit') return resolvedTransitParts || summary.context?.transitParts || null;
    return resolvedBirthParts || summary.context?.birthParts || null;
  };

  const buildMoonTitle = (section) => {
    const label = section?.meta?.title || section?.meta?.contextKey || '';
    return label ? `Moon cycle · ${label}` : '';
  };

  $: sectionsData = (() => {
    const sections = Array.isArray(summary.sections) ? summary.sections : [];
    return sections.map((section) => {
      const map = new Map();
      (section?.points || []).forEach((p) => {
        const key = (p.label || '').toLowerCase();
        if (key) map.set(key, p);
      });
      return { meta: section?.meta || {}, pointsMap: map };
    });
  })();
</script>

<div class="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-2">
  <p class="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80 font-semibold">Sun · Moon · Asc</p>
  {#if sectionsData.length}
    <div class="space-y-3">
      {#each sectionsData as section, index}
        <div class="space-y-2">
          {#if section.meta?.title || section.meta?.contextKey}
            <div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
              <span>{section.meta?.title || section.meta?.contextKey}</span>
              {#if section.meta?.datetime}
                <span class="text-[11px] tracking-[0.12em] text-slate-500">{section.meta.datetime}</span>
              {/if}
            </div>
          {/if}
          {#if section.pointsMap.size}
            <div class="space-y-2">
              {#each order as target}
                {@const point = section.pointsMap.get(target.toLowerCase())}
                {#if point}
                  <div class="flex flex-wrap items-start gap-2 text-sm font-semibold text-slate-100 min-w-0">
                    <span aria-hidden="true">{point.icon || POINT_SYMBOLS[target.toLowerCase()] || '★'}</span>
                    <span class="min-w-0 break-words">{point.label || target} · in {signName(point.sign)} {signSymbol(point.sign)} · @ {point.degree || '—'}</span>
                  </div>
                {/if}
              {/each}
            </div>
            <HomeSummaryMoonCycle
              summary={summary}
              mode={mode}
              parts={resolvePartsForSection(section)}
              title={buildMoonTitle(section)}
            />
          {:else}
            <p class="text-sm text-slate-400">Generate a chart to see Sun, Moon, and Ascendant.</p>
          {/if}
        </div>
        {#if index < sectionsData.length - 1}
          <div class="border-t border-slate-800/60"></div>
        {/if}
      {/each}
    </div>
  {:else}
    <p class="text-sm text-slate-400">Generate a chart to see Sun, Moon, and Ascendant.</p>
  {/if}
</div>
