<script>
  import { get } from 'svelte/store';
  import { buildSummary } from '$lib/astro/summary';
  import { requestChart, requestReport } from '$lib/api/client';
  import { buildChartPayload, buildReportPayload } from '$lib/payloads';
  import { cacheStore, setCacheEntry } from '$lib/state/cacheStore';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import ApiResponseView from '$components/output/ApiResponseView.svelte';
  import AspectsList from '$components/output/AspectsList.svelte';
  import ReportView from '$components/output/ReportView.svelte';
  import SummarySection from '$components/output/SummarySection.svelte';
  import SvgViewer from '$components/output/SvgViewer.svelte';
  import ChartForm from './ChartForm.svelte';

  const pageId = 'esoteric';
  const emptySummary = { sections: [], ranges: [], aspects: [], context: {}, rawAspects: [] };

  let status = '';
  let errorMessage = '';
  let svgMarkup = '';
  let apiResponse = null;
  let summary = emptySummary;
  let report = null;
  let loading = false;

  $: activeMode = $inputStore.mode;
  $: cached = $cacheStore.byPage?.[pageId]?.byMode?.[activeMode];
  $: if (cached) {
    const chartCache = cached.chart || {};
    const state = get(inputStore);
    const cfg = { ...get(configStore), asc_moon_sun_range_enabled: true, include_aspects: true };
    const { birthParts, transitParts } = buildChartPayload(activeMode, state, cfg);

    svgMarkup = chartCache.svg || '';
    apiResponse = chartCache.response || null;
    summary =
      chartCache.summary ||
      (chartCache.response ? buildSummary(activeMode, chartCache.response, birthParts, transitParts) : emptySummary);
    report = (cached.report && cached.report.report) || cached.report || report;
  } else {
    svgMarkup = '';
    apiResponse = null;
    summary = emptySummary;
    report = null;
  }

  async function generateChart() {
    status = '';
    errorMessage = '';
    loading = true;
    const state = get(inputStore);
    const cfg = { ...get(configStore), asc_moon_sun_range_enabled: true, include_aspects: true };
    const { payload, birthParts, transitParts } = buildChartPayload(state.mode, state, cfg);
    try {
      const { json, svg } = await requestChart(state.mode, payload);
      apiResponse = json;
      svgMarkup = svg;
      summary = buildSummary(state.mode, json, birthParts, transitParts);
      setCacheEntry(pageId, state.mode, 'chart', { svg, response: json, summary });
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
    const state = get(inputStore);
    const cfg = { ...get(configStore), asc_moon_sun_range_enabled: true, include_aspects: true };
    try {
      const payload = buildReportPayload(state.mode, state, cfg);
      report = await requestReport(payload);
      setCacheEntry(pageId, state.mode, 'report', { report });
      status = 'Report ready.';
    } catch (err) {
      errorMessage = err?.message || 'Failed to generate report.';
      status = 'Report generation failed.';
    }
  }
</script>

<div class="page-shell pb-12" id="esoteric-workbench">
  <div class="grid lg:grid-cols-3 gap-6">
    <div class="space-y-4">
      <ChartForm on:submit={generateChart} />
    </div>

    <div class="lg:col-span-2 space-y-4">
      <div class="glass-card p-4 flex items-center justify-between">
        <div>
          <p class="section-title text-xs">Status</p>
          <p class="text-sm text-slate-200">{status || 'Idle'}</p>
          {#if errorMessage}
            <p class="text-sm text-rose-300">{errorMessage}</p>
          {/if}
        </div>
        {#if loading}
          <span class="badge">Working…</span>
        {:else if svgMarkup}
          <span class="badge">Chart ready</span>
        {/if}
      </div>

      {#if summary.sections && summary.sections.length}
        {#each summary.sections as section}
          <SummarySection {section} />
        {/each}
      {/if}

      {#if summary.aspects && summary.aspects.length}
        <AspectsList aspects={summary.aspects} />
      {/if}

      <SvgViewer svgMarkup={svgMarkup} />

      <div class="glass-card p-4 space-y-3">
        <div class="flex items-center gap-3">
          <button class="button-primary" type="button" on:click={generateReport} disabled={loading}>Generate report</button>
          {#if report}
            <span class="badge">Cached</span>
          {/if}
        </div>
        <p class="text-sm text-slate-400">Uses the same payload as the chart.</p>
      </div>

      <ReportView {report} />

      <ApiResponseView data={apiResponse} />
    </div>
  </div>
</div>
