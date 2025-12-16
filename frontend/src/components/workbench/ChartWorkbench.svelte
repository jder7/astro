<script>
  import { get } from 'svelte/store';
  import { buildSummary } from '$lib/astro/summary';
  import { requestChart, requestReport, requestTransitRange } from '$lib/api/client';
  import { buildChartPayload, buildRangePayload, buildReportPayload } from '$lib/payloads';
  import { cacheStore, setCacheForMode } from '$lib/state/cacheStore';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import { rangeStore } from '$lib/state/rangeStore';
  import ApiResponseView from '../output/ApiResponseView.svelte';
  import AspectsList from '../output/AspectsList.svelte';
  import RangeSummary from '../output/RangeSummary.svelte';
  import ReportView from '../output/ReportView.svelte';
  import SummarySection from '../output/SummarySection.svelte';
  import SvgViewer from '../output/SvgViewer.svelte';
  import ChartForm from './ChartForm.svelte';
  import ConfigPanel from './ConfigPanel.svelte';
  import RangeForm from './RangeForm.svelte';

  export let page = 'home';
  export let showRange = false;
  export let enableReport = false;

  let status = '';
  let errorMessage = '';
  let svgMarkup = '';
  let apiResponse = null;
  let summary = { sections: [], ranges: [], aspects: [], context: {} };
  let report = null;
  let rangeResult = null;
  let loading = false;
  let rangeLoading = false;
  $: rangeSummary = rangeResult
    ? buildSummary('transit', {
        snapshot: rangeResult.snapshots?.[0],
        ascendant_day_range: rangeResult.ascendant_day_range,
        moon_month_range: rangeResult.moon_month_range,
        sun_year_range: rangeResult.sun_year_range,
      })
    : null;

  $: activeMode = $inputStore.mode;
  $: cached = $cacheStore.byMode?.[activeMode];
  $: if (cached) {
    svgMarkup = cached.svg || '';
    apiResponse = cached.response || null;
    summary = cached.summary || summary;
    report = cached.report || report;
  } else {
    svgMarkup = '';
    apiResponse = null;
    summary = { sections: [], ranges: [], aspects: [], context: {} };
    report = null;
  }

  async function generateChart() {
    status = '';
    errorMessage = '';
    loading = true;
    const state = get(inputStore);
    const cfg = get(configStore);
    const { payload, birthParts, transitParts } = buildChartPayload(state.mode, state, cfg);
    try {
      const { json, svg } = await requestChart(state.mode, payload);
      apiResponse = json;
      svgMarkup = svg;
      summary = buildSummary(state.mode, json, birthParts, transitParts);
      setCacheForMode(state.mode, { svg, response: json, summary });
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
    const cfg = get(configStore);
    try {
      const payload = buildReportPayload(state.mode, state, cfg);
      report = await requestReport(payload);
      setCacheForMode(state.mode, { report });
      status = 'Report ready.';
    } catch (err) {
      errorMessage = err?.message || 'Failed to generate report.';
      status = 'Report generation failed.';
    }
  }

  async function runRange(event) {
    if (event?.preventDefault) event.preventDefault();
    rangeLoading = true;
    status = '';
    errorMessage = '';
    try {
      const state = get(inputStore);
      const cfg = get(configStore);
      const range = get(rangeStore);
      const payload = buildRangePayload(state, cfg, range, state.mode !== 'transit');
      rangeResult = await requestTransitRange(payload);
      status = `Range computed (${rangeResult.snapshots?.length || 0} snapshots).`;
    } catch (err) {
      errorMessage = err?.message || 'Failed to run range request.';
      status = 'Range request failed.';
    } finally {
      rangeLoading = false;
    }
  }
</script>

<div class="page-shell pb-12">
  <div class="grid lg:grid-cols-3 gap-6">
    <div class="space-y-4">
      <ConfigPanel />
      <ChartForm on:submit={generateChart} />
      {#if showRange}
        <RangeForm on:range={runRange} loading={rangeLoading} />
      {/if}
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

      {#if summary.ranges && summary.ranges.length}
        <RangeSummary ranges={summary.ranges} />
      {/if}

      <SvgViewer svgMarkup={svgMarkup} />

      {#if enableReport}
        <div class="glass-card p-4 space-y-3">
          <div class="flex items-center gap-3">
            <button class="button-primary" type="button" on:click={generateReport} disabled={loading}>Generate report</button>
            {#if report}
              <span class="badge">Cached</span>
            {/if}
          </div>
          <p class="text-sm text-slate-400">Uses the same payload as the chart.</p>
        </div>
      {/if}

      <ReportView {report} />

      <ApiResponseView data={apiResponse} />

      {#if rangeResult}
        <div class="glass-card p-4 space-y-2">
          <div class="flex items-center justify-between">
            <p class="section-title text-xs">Range</p>
            <span class="badge">{rangeResult.snapshots?.length || 0} snapshots</span>
          </div>
          <p class="text-sm text-slate-300">Ascendant sweeps, moon and sun ranges reuse the transit moment + config.</p>
        </div>
        {#if rangeSummary?.ranges?.length}
          <RangeSummary ranges={rangeSummary.ranges} />
        {/if}
      {/if}
    </div>
  </div>
</div>
