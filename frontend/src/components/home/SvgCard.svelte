<script>
  export let svgMarkup = '';
  export let loading = false;
  export let onDownloadPdf = () => {};
  export let onDownloadSvg = () => {};
  export let onZoom = () => {};
</script>

<div class="flowbite-card space-y-4" id="svg-card">
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">SVG output</p>
      <h2>Chart preview</h2>
    </div>
    <div class="flex items-center gap-2">
      <button class="button-ghost" type="button" on:click={onDownloadPdf} disabled={!svgMarkup || loading}>
        PDF
      </button>
      <button class="button-ghost" type="button" on:click={onDownloadSvg} disabled={!svgMarkup}>
        Download SVG
      </button>
      <button class="button-ghost" type="button" on:click={onZoom} disabled={!svgMarkup}>
        Zoom
      </button>
      {#if svgMarkup}
        <span class="badge">Live render</span>
      {/if}
    </div>
  </div>
  <div class="relative rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
    {#if svgMarkup}
      <div class="w-full flex justify-center overflow-auto max-h-[540px]">
        <div class="min-w-[320px]" aria-live="polite">
          {@html svgMarkup}
        </div>
      </div>
    {:else}
      <p class="text-sm text-slate-400">
        Fill in the form and click <strong>Generate chart</strong> to render a natal, transit, or dual-wheel SVG here.
      </p>
    {/if}
  </div>
</div>
