<script>
  import { get } from 'svelte/store';
  import { onMount, tick } from 'svelte';
  import { requestChartDataAndSvg, requestChartPdf } from '$lib/api/client';
  import { buildChartPayload } from '$lib/payloads';
  import { cacheStore, setCacheEntry } from '$lib/state/cacheStore';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import { saveHistoryForState } from '$lib/state/subjectHistoryStore';
  import { applyShareParamsFromUrl, clearShareParams, hasShareParams } from '$lib/utils/shareParams';
  import { showToast } from '$lib/state/toastStore';
  import { downloadBlob } from '$lib/utils/download';
  import { animateCards } from '$lib/animations/pageTransitions';
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
  let chartResultKey = 0;
  let cachedBirthParts = null;
  let cachedTransitParts = null;

  $: activeMode = $inputStore.mode;
  $: cached = $cacheStore.byPage?.[pageId]?.byMode?.[activeMode];
  $: if (cached) {
    const chartCache = cached.chart || {};
    svgMarkup = chartCache.svg || '';
    apiResponse = chartCache.response || null;
    // Derive parts in SummaryCard instead of caching them.
    cachedSummary = chartCache.summary || null;
    cachedReport = cached.report?.report || cached.report || null;
    cachedBirthParts = chartCache.birthParts || null;
    cachedTransitParts = chartCache.transitParts || null;
  } else {
    svgMarkup = '';
    apiResponse = null;
    cachedSummary = null;
    cachedReport = null;
    cachedBirthParts = null;
    cachedTransitParts = null;
  }
  $: if (cached?.response && !loading && !status) {
    status = 'Loaded cached results.';
  }

  async function generateChart() {
    status = '';
    errorMessage = '';
    loading = true;
    clearShareParams();
    const state = get(inputStore);
    saveHistoryForState(state);
    const cfg = get(configStore);
    const { payload, birthParts, transitParts } = buildChartPayload(state.mode, state, cfg);
    try {
      const { json, svg } = await requestChartDataAndSvg(state.mode, payload);
      apiResponse = json;
      svgMarkup = svg;
      setCacheEntry(pageId, state.mode, 'chart', {
        svg,
        response: json,
        summary: null,
        birthParts,
        transitParts,
      });
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

  onMount(async () => {
    if (!hasShareParams()) return;
    const { applied } = applyShareParamsFromUrl();
    if (!applied) return;
    await tick();
    await generateChart();
    showToast('Loaded shared inputs and generated.');
  });
</script>

<div class="page-shell pb-12" id="home-workbench">
  <div id="home-chart-inputs" class="grid lg:grid-cols-3 gap-6">
    <div class="space-y-4 min-w-0">
      <ChartForm
        on:submit={generateChart}
        resultsReady={Boolean(apiResponse)}
        resultKey={chartResultKey}
        focusTargetId="home-status"
        loading={loading}
      />
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
      <HomeSummaryCard
        summary={cachedSummary}
        apiResponse={apiResponse}
        mode={activeMode}
        birthParts={cachedBirthParts}
        transitParts={cachedTransitParts}
      />

      <HomeSvgCard svgMarkup={svgMarkup} loading={loading} mode={activeMode} />

      <HomeReportCard cachedReport={cachedReport} mode={activeMode} page={pageId} />
    </div>
  </div>
</div>
