<script>
  import HomeSummaryMainPoints from './HomeSummaryMainPoints.svelte';
  import HomeSummaryAspects from './HomeSummaryAspects.svelte';
  import { buildSummary } from '$lib/astro/summary';
  export let summary = { sections: [], ranges: [], aspects: [], context: {}, rawAspects: [] };
  export let apiResponse = null;
  export let mode = 'natal';
  export let birthParts = null;
  export let transitParts = null;

  let resolvedBirthParts = null;
  let resolvedTransitParts = null;
  $: {
    resolvedBirthParts = birthParts || summary?.context?.birthParts || null;
    resolvedTransitParts = transitParts || summary?.context?.transitParts || null;
  }

  const mergeContextParts = (base) => ({
    ...base,
    context: {
      ...(base?.context || {}),
      birthParts: base?.context?.birthParts ?? resolvedBirthParts,
      transitParts: base?.context?.transitParts ?? resolvedTransitParts,
    },
  });

  $: computedSummaryRaw =
    summary && summary.sections && summary.sections.length
      ? summary
      : apiResponse
        ? buildSummary(mode, apiResponse, resolvedBirthParts, resolvedTransitParts)
        : summary;

  $: computedSummary = mergeContextParts(computedSummaryRaw || {});
</script>

<div class="flowbite-card space-y-4" id="summary-card" tabindex="-1">
  <div class="card-head">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Summary</p>
      <h2>Highlights</h2>
    </div>
    <div class="card-head-actions">
      {#if computedSummary.context?.birth}
        <span class="badge">Birth: {computedSummary.context.birth}</span>
      {/if}
      {#if computedSummary.context?.transit}
        <span class="badge">Transit: {computedSummary.context.transit}</span>
      {/if}
    </div>
  </div>

  <div class="grid gap-4">
    <HomeSummaryMainPoints
      summary={computedSummary}
      mode={mode}
      birthParts={resolvedBirthParts}
      transitParts={resolvedTransitParts}
    />

    <HomeSummaryAspects summary={computedSummary} mode={mode} />
  </div>
</div>
