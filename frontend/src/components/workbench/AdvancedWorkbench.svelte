<script>
  import { get } from 'svelte/store';
  import { buildSummary } from '$lib/astro/summary';
  import { requestChart, requestTransitRange } from '$lib/api/client';
  import { buildChartPayload, buildRangePayload } from '$lib/payloads';
  import { cacheStore, setCacheEntry } from '$lib/state/cacheStore';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import { rangeStore } from '$lib/state/rangeStore';
  
  import StatusCard from '$components/advanced/StatusCard.svelte';
  import SummaryCard from '$components/advanced/SummaryCard.svelte';
  import AspectsCard from '$components/advanced/AspectsCard.svelte';
  import RangeCard from '$components/advanced/RangeCard.svelte';
  import SvgCard from '$components/advanced/SvgCard.svelte';
  import ReportCard from '$components/advanced/ReportCard.svelte';
  import ChartForm from './ChartForm.svelte';
  import RangeForm from './RangeForm.svelte';

  const pageId = 'advanced';
  const emptySummary = { sections: [], ranges: [], aspects: [], context: {}, rawAspects: [] };

  let status = '';
  let errorMessage = '';
  let svgMarkup = '';
  let apiResponse = null;
  let summary = emptySummary;
  let cachedReport = null;
  let rangeResult = null;
  let loading = false;
  let rangeLoading = false;

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
    cachedReport = (cached.report && cached.report.report) || cached.report || null;
  } else {
    svgMarkup = '';
    apiResponse = null;
    summary = emptySummary;
    cachedReport = null;
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

  async function runRange(event) {
    if (event?.preventDefault) event.preventDefault();
    rangeLoading = true;
    status = '';
    errorMessage = '';
    try {
      const state = get(inputStore);
      const cfg = { ...get(configStore), asc_moon_sun_range_enabled: true, include_aspects: true };
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

<div class="page-shell pb-12" id="advanced-workbench">
  <div class="grid lg:grid-cols-3 gap-6">
    <div class="space-y-4">
      <ChartForm on:submit={generateChart} />
      <RangeForm on:range={runRange} loading={rangeLoading} />
    </div>

    <div class="lg:col-span-2 space-y-4">
      <StatusCard {status} {errorMessage} loading={loading} ready={Boolean(svgMarkup)} />

      <SummaryCard {summary} />

      <AspectsCard {summary} />

      <SvgCard {svgMarkup} />

      <ReportCard mode={activeMode} page={pageId} cachedReport={cachedReport} />

      <RangeCard rangeResult={rangeResult} {summary} />
    </div>
  </div>
</div>
