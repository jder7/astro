<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { buildSummary } from '$lib/astro/summary';
  import { requestChart, requestChartPdf, requestReport, requestReportPdf } from '$lib/api/client';
  import { buildChartPayload, buildReportPayload } from '$lib/payloads';
  import { cacheStore, setCacheForMode } from '$lib/state/cacheStore';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import { copyToClipboard, downloadBlob, downloadSvg } from '$lib/utils/download';
  import ApiResponseView from '$components/output/ApiResponseView.svelte';
  import SummaryCard from '$components/home/SummaryCard.svelte';
  import SvgCard from '$components/home/SvgCard.svelte';
  import ReportCard from '$components/home/ReportCard.svelte';
  import ChartForm from './ChartForm.svelte';

  const emptySummary = { sections: [], ranges: [], aspects: [], context: {} };

  let status = '';
  let errorMessage = '';
  let svgMarkup = '';
  let apiResponse = null;
  let summary = emptySummary;
  let report = null;
  let birthParts = null;
  let transitParts = null;
  let loading = false;
  let reportLoading = false;
  let zoomOpen = false;
  let zoomScale = 1;
  let copiedReport = false;

  $: activeMode = $inputStore.mode;
  $: cached = $cacheStore.byMode?.[activeMode];
  $: if (cached) {
    svgMarkup = cached.svg || '';
    apiResponse = cached.response || null;
    birthParts = cached.birthParts || null;
    transitParts = cached.transitParts || null;
    summary =
      cached.summary ||
      (cached.response ? buildSummary(activeMode, cached.response, cached.birthParts, cached.transitParts) : emptySummary);
    report = cached.report || null;
  } else {
    svgMarkup = '';
    apiResponse = null;
    summary = emptySummary;
    report = null;
    birthParts = null;
    transitParts = null;
  }
  $: if (cached?.response && !loading && !reportLoading && !status) {
    status = 'Loaded cached results.';
  }

  $: reportText = typeof report === 'string' ? report : report?.text || '';
  $: reportHtml = reportText
    ? reportText
        .split('\n')
        .filter(Boolean)
        .map((line) => `<p>${line}</p>`)
        .join('')
    : '';
  $: reportTitle = report?.title || 'Detailed text';

  function closeZoom() {
    zoomOpen = false;
    zoomScale = 1;
  }

  onMount(() => {
    const handler = (event) => {
      if (event.key === 'Escape') closeZoom();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  async function generateChart() {
    status = '';
    errorMessage = '';
    loading = true;
    const state = get(inputStore);
    const cfg = get(configStore);
    const { payload, birthParts: birthPartsComputed, transitParts: transitPartsComputed } = buildChartPayload(state.mode, state, cfg);
    try {
      const { json, svg } = await requestChart(state.mode, payload);
      apiResponse = json;
      svgMarkup = svg;
      birthParts = birthPartsComputed;
      transitParts = transitPartsComputed;
      summary = buildSummary(state.mode, json, birthPartsComputed, transitPartsComputed);
      setCacheForMode(state.mode, { svg, response: json, summary, birthParts: birthPartsComputed, transitParts: transitPartsComputed });
      status = 'Chart generated successfully.';
    } catch (err) {
      errorMessage = err?.message || 'Failed to generate chart.';
      status = 'Something went wrong.';
    } finally {
      loading = false;
    }
  }

  async function generateReport() {
    errorMessage = '';
    status = 'Generating report…';
    reportLoading = true;
    const state = get(inputStore);
    const cfg = get(configStore);
    try {
      const payload = buildReportPayload(state.mode, state, cfg);
      report = await requestReport(payload);
      setCacheForMode(state.mode, { report });
      status = 'Report ready.';
    } catch (err) {
      errorMessage = err?.message || 'Failed to generate report.';
      status = 'Report generation failed.';
    } finally {
      reportLoading = false;
    }
  }

  async function downloadChartPdf() {
    if (!svgMarkup) {
      status = 'Generate a chart first to download PDF.';
      return;
    }
    errorMessage = '';
    status = 'Preparing chart PDF…';
    const state = get(inputStore);
    const cfg = get(configStore);
    const { payload } = buildChartPayload(state.mode, state, cfg);
    const { asc_moon_sun_range_enabled, ...pdfPayload } = payload;
    const body = { mode: state.mode, ...pdfPayload, grid_view: false };
    try {
      const blob = await requestChartPdf(body);
      downloadBlob(blob, `${state.mode}-chart.pdf`);
      status = 'Chart PDF downloaded.';
    } catch (err) {
      errorMessage = err?.message || 'Failed to download chart PDF.';
      status = 'Chart PDF failed.';
    }
  }

  async function downloadReportPdf() {
    errorMessage = '';
    status = 'Preparing report PDF…';
    const state = get(inputStore);
    const cfg = get(configStore);
    try {
      const payload = buildReportPayload(state.mode, state, cfg);
      const blob = await requestReportPdf(payload);
      downloadBlob(blob, `${state.mode}-report.pdf`);
      status = 'Report PDF downloaded.';
    } catch (err) {
      errorMessage = err?.message || 'Failed to download report PDF.';
      status = 'Report PDF failed.';
    }
  }

  async function copyReport() {
    if (!reportText) return;
    const ok = await copyToClipboard(reportText);
    copiedReport = ok;
    setTimeout(() => (copiedReport = false), 1200);
  }

  function openZoom() {
    if (!svgMarkup) return;
    zoomScale = 1;
    zoomOpen = true;
  }

  function zoomIn() {
    zoomScale = Math.min(3, zoomScale + 0.2);
  }

  function zoomOut() {
    zoomScale = Math.max(0.5, zoomScale - 0.2);
  }
</script>

<div class="page-shell pb-12" id="home-workbench">
  <div class="grid lg:grid-cols-3 gap-6">
    <div class="space-y-4">
      <ChartForm on:submit={generateChart} />
      <div class="flowbite-card flex items-center justify-between">
        <div>
          <p class="text-sm text-cyan-200/80 font-semibold">Status</p>
          <p class="text-sm text-slate-200">{status || 'Idle'}</p>
          {#if errorMessage}
            <p class="text-sm text-rose-300">{errorMessage}</p>
          {/if}
        </div>
        {#if loading || reportLoading}
          <span class="badge">Working…</span>
        {:else if svgMarkup}
          <span class="badge">Ready</span>
        {/if}
      </div>
    </div>

    <div class="lg:col-span-2 space-y-6">
      <SummaryCard {summary} mode={activeMode} {birthParts} {transitParts} />

      <SvgCard
        {svgMarkup}
        {loading}
        onDownloadPdf={downloadChartPdf}
        onDownloadSvg={() => downloadSvg(svgMarkup)}
        onZoom={openZoom}
      />

      <ReportCard
        reportTitle={reportTitle}
        reportHtml={reportHtml}
        reportText={reportText}
        hasReport={Boolean(report)}
        loading={loading}
        reportLoading={reportLoading}
        copied={copiedReport}
        onLoadReport={generateReport}
        onDownloadPdf={downloadReportPdf}
        onCopy={copyReport}
      />

      <ApiResponseView data={apiResponse} title="API response (cached)" />
    </div>
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
