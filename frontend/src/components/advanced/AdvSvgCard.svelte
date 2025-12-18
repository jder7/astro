<script>
  export let svgMarkup = '';
</script>

<div class="flowbite-card space-y-3">
  <div class="flex items-center justify-between">
    <p class="section-title text-xs">SVG output</p>
    {#if svgMarkup}
      <span class="badge">Live render</span>
    {/if}
  </div>
<div class="bg-slate-950/60 border border-slate-800 rounded-2xl p-4" aria-live="polite" id="adv-svg-panel">
    {#if svgMarkup}
      {@html svgMarkup}
    {:else}
      <p class="text-sm text-slate-400">Run a chart to see the SVG output.</p>
    {/if}
  </div>
</div>
