<script>
  import { get } from 'svelte/store';
  import { requestChartDataAndSvg, requestChartPdf } from '$lib/api/client';
  import { buildChartPayload } from '$lib/payloads';
  import { cacheStore, setCacheEntry } from '$lib/state/cacheStore';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import { downloadBlob } from '$lib/utils/download';
  import HomeSummaryCard from '$components/home/HomeSummaryCard.svelte';
  import HomeSvgCard from '$components/home/HomeSvgCard.svelte';
  import HomeReportCard from '$components/home/HomeReportCard.svelte';
  import StatusCard from '$components/shared/StatusCard.svelte';
  import ChartForm from './ChartForm.svelte';

  const pageId = 'home';

  let status = '';
  let errorMessage = '';
  let svgMarkup = '';
  let apiResponse = null;
  let cachedSummary = null;
  let cachedReport = null;
  let loading = false;

  $: activeMode = $inputStore.mode;
  $: cached = $cacheStore.byPage?.[pageId]?.byMode?.[activeMode];
  $: if (cached) {
    const chartCache = cached.chart || {};
    svgMarkup = chartCache.svg || '';
    apiResponse = chartCache.response || null;
    // Derive parts in SummaryCard instead of caching them.
    cachedSummary = chartCache.summary || null;
    cachedReport = cached.report?.report || cached.report || null;
  } else {
    svgMarkup = '';
    apiResponse = null;
    cachedSummary = null;
    cachedReport = null;
  }
  $: if (cached?.response && !loading && !status) {
    status = 'Loaded cached results.';
  }

  async function generateChart() {
    status = '';
    errorMessage = '';
    loading = true;
    const state = get(inputStore);
    const cfg = get(configStore);
    const { payload } = buildChartPayload(state.mode, state, cfg);
    try {
      const { json, svg } = await requestChartDataAndSvg(state.mode, payload);
      apiResponse = json;
      svgMarkup = svg;
      setCacheEntry(pageId, state.mode, 'chart', { svg, response: json });
      status = 'Chart generated successfully.';
    } catch (err) {
      errorMessage = err?.message || 'Failed to generate chart.';
      status = 'Something went wrong.';
    } finally {
      loading = false;
    }
  }

</script>

<div class="page-shell pb-12" id="home-workbench">
  <div id="home-chart-inputs" class="grid lg:grid-cols-3 gap-6">
    <div class="space-y-4 min-w-0">
      <ChartForm on:submit={generateChart} />
      <StatusCard
        id="home-status"
        label="Status"
        labelClass="text-sm text-cyan-200/80 font-semibold"
        statusText={status}
        errorMessage={errorMessage}
        loading={loading}
        ready={Boolean(svgMarkup)}
      />
    </div>

    <div id="home-chart-results" class="lg:col-span-2 space-y-6 min-w-0">
      <HomeSummaryCard summary={cachedSummary} apiResponse={apiResponse} mode={activeMode} />

      <HomeSvgCard svgMarkup={svgMarkup} loading={loading} mode={activeMode} />

      <HomeReportCard cachedReport={cachedReport} mode={activeMode} page={pageId} />
    </div>
  </div>
</div>
