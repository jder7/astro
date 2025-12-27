<script>
  import { get } from 'svelte/store';
  import { tick } from 'svelte';
  import { buildSummary } from '$lib/astro/summary';
  import { requestChartData, requestReport } from '$lib/api/client';
  import { buildChartPayload, buildReportPayload } from '$lib/payloads';
  import { cacheStore, setCacheEntry } from '$lib/state/cacheStore';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import EsotericSummaryCard from '$components/esoteric/EsotericSummaryCard.svelte';
  import { animateCards } from '$lib/animations/pageTransitions';
  import StatusCard from '$components/shared/StatusCard.svelte';
  import ChartForm from './ChartForm.svelte';

  const pageId = 'esoteric';
  const emptySummary = { sections: [], ranges: [], aspects: [], context: {}, rawAspects: [] };

  let status = '';
  let errorMessage = '';
  let apiResponse = null;
  let summary = emptySummary;
  let report = null;
  let loading = false;
  let chartResultKey = 0;

  $: activeMode = $inputStore.mode;
  $: cached = $cacheStore.byPage?.[pageId]?.byMode?.[activeMode];
  $: if (cached) {
    const chartCache = cached.chart || {};
    const state = get(inputStore);
    const cfg = { ...get(configStore), asc_moon_sun_range_enabled: true, include_aspects: true };
    const { birthParts, transitParts } = buildChartPayload(activeMode, state, cfg);

    apiResponse = chartCache.response || null;
    summary =
      chartCache.summary ||
      (chartCache.response ? buildSummary(activeMode, chartCache.response, birthParts, transitParts) : emptySummary);
    report = (cached.report && cached.report.report) || cached.report || report;
  } else {
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
      const json = await requestChartData(state.mode, payload);
      apiResponse = json;
      summary = buildSummary(state.mode, json, birthParts, transitParts);
      setCacheEntry(pageId, state.mode, 'chart', { response: json, summary });
      await tick();
      animateCards();
      chartResultKey += 1;
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
  <div id="esoteric-chart-inputs" class="grid lg:grid-cols-3 gap-6">
    <div class="space-y-4 min-w-0">
      <ChartForm
        on:submit={generateChart}
        resultsReady={Boolean(apiResponse)}
        resultKey={chartResultKey}
        focusTargetId="esoteric-status"
      />
      <StatusCard
        id="esoteric-status"
        label="Status"
        statusText={status}
        errorMessage={errorMessage}
        loading={loading}
        ready={Boolean(apiResponse)}
        readyLabel="Chart ready"
      />
    </div>

    <div class="lg:col-span-2 space-y-6 min-w-0" id="esoteric-chart-results">
      <EsotericSummaryCard {summary} />

      <div class="flowbite-card space-y-3">
        <div class="card-head">
          <div>
            <p class="text-sm text-cyan-200/80 font-semibold">Reports</p>
            <h2>Esoteric insights</h2>
          </div>
          <div class="card-head-actions">
            <button class="button-primary" type="button" on:click={generateReport} disabled={loading}>Generate report</button>
            {#if report}
              <span class="badge">Cached</span>
            {/if}
          </div>
        </div>
        <p class="text-sm text-slate-400">Uses the same payload as the chart.</p>
      </div>
    </div>
  </div>
</div>
