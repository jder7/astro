<script>
  import { get } from 'svelte/store';
  import { requestChartPdf } from '$lib/api/client';
  import { buildChartPayload } from '$lib/payloads';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import { downloadBlob, downloadSvg } from '$lib/utils/download';

  export let svgMarkup = '';
  export let loading = false;
  export let mode = 'natal';

  let zoomOpen = false;
  let zoomScale = 1;

  const openZoom = () => {
    if (!svgMarkup) return;
    zoomScale = 1;
    zoomOpen = true;
  };

  const closeZoom = () => {
    zoomOpen = false;
    zoomScale = 1;
  };

  const zoomIn = () => {
    zoomScale = Math.min(3, zoomScale + 0.2);
  };

  const zoomOut = () => {
    zoomScale = Math.max(0.5, zoomScale - 0.2);
  };

  const downloadPdf = async () => {
    if (!svgMarkup) return;
    const state = get(inputStore);
    const cfg = get(configStore);
    const { payload } = buildChartPayload(mode, state, cfg);
    const { asc_moon_sun_range_enabled, ...pdfPayload } = payload;
    const body = { mode, ...pdfPayload, grid_view: false };
    try {
      const blob = await requestChartPdf(body);
      downloadBlob(blob, `${mode}-chart.pdf`);
    } catch (err) {
      console.warn('PDF download failed', err);
    }
  };
</script>

<div class="flowbite-card space-y-4" id="svg-card">
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">SVG output</p>
      <h2>Chart preview</h2>
    </div>
    <div class="flex items-center gap-2">
      <button class="button-ghost" type="button" on:click={downloadPdf} disabled={!svgMarkup || loading}>
        PDF
      </button>
      <button class="button-ghost" type="button" on:click={() => downloadSvg(svgMarkup)} disabled={!svgMarkup}>
        Download SVG
      </button>
      <button class="button-ghost" type="button" on:click={openZoom} disabled={!svgMarkup}>
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

  {#if zoomOpen}
    <div class="modal-backdrop" role="dialog" aria-label="Zoomed chart view" on:click={closeZoom}>
      <div class="modal-panel max-w-6xl" on:click|stopPropagation>
        <div class="flex items-center justify-between">
          <div>
            <p class="section-title text-xs">Zoom</p>
            <p class="text-sm text-slate-300">Use the controls to inspect the SVG.</p>
          </div>
          <div class="flex items-center gap-2">
            <button class="button-ghost" type="button" on:click={zoomOut}>−</button>
            <button class="button-ghost" type="button" on:click={zoomIn}>+</button>
            <button class="button-ghost" type="button" on:click={closeZoom}>Close</button>
          </div>
        </div>
        <div class="border border-slate-800 rounded-2xl bg-slate-950/80 p-4 overflow-auto max-h-[720px]">
          {#if svgMarkup}
            <div class="w-full flex justify-center">
              <div class="min-w-[420px] origin-top" style={`transform: scale(${zoomScale});`}>
                {@html svgMarkup}
              </div>
            </div>
          {:else}
            <p class="text-sm text-slate-400">No chart to zoom.</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
