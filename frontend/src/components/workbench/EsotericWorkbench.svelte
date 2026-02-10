<script>
  import { get } from 'svelte/store';
  import { onMount, tick } from 'svelte';
  import { buildSummary } from '$lib/astro/summary';
  import { requestChartData } from '$lib/api/client';
  import { buildChartPayload } from '$lib/payloads';
  import { cacheStore, setCacheEntry } from '$lib/state/cacheStore';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import { saveHistoryForState } from '$lib/state/subjectHistoryStore';
  import { applyShareParamsFromUrl, clearShareParams, hasShareParams } from '$lib/utils/shareParams';
  import { showToast } from '$lib/state/toastStore';
  import EsotericSummaryCard from '$components/esoteric/EsotericSummaryCard.svelte';
  import EsotericSkyMapCard from '$components/esoteric/EsotericSkyMapCard.svelte';
  import { animateCards } from '$lib/animations/pageTransitions';
  import StatusCard from '$components/shared/StatusCard.svelte';
  import ChartForm from './ChartForm.svelte';

  const pageId = 'esoteric';
  const emptySummary = { sections: [], ranges: [], aspects: [], context: {}, rawAspects: [] };

  let status = '';
  let errorMessage = '';
  let apiResponse = null;
  let summary = emptySummary;
  let loading = false;
  let chartResultKey = 0;

  $: activeMode = $inputStore.mode;
  $: cached = $cacheStore.byPage?.[pageId]?.byMode?.[activeMode];
  $: if (cached) {
    const chartCache = cached.chart || {};
    const state = get(inputStore);
    const cfg = { ...get(configStore), asc_moon_sun_range_enabled: false, include_aspects: true };
    const { birthParts, transitParts } = buildChartPayload(activeMode, state, cfg);

    apiResponse = chartCache.response || null;
    summary =
      chartCache.summary ||
      (chartCache.response ? buildSummary(activeMode, chartCache.response, birthParts, transitParts) : emptySummary);
  } else {
    apiResponse = null;
    summary = emptySummary;
  }

  async function generateChart() {
    status = '';
    errorMessage = '';
    loading = true;
    clearShareParams();
    const state = get(inputStore);
    saveHistoryForState(state);
    const cfg = { ...get(configStore), asc_moon_sun_range_enabled: false, include_aspects: true };
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

  onMount(async () => {
    if (!hasShareParams()) return;
    const { applied } = applyShareParamsFromUrl();
    if (!applied) return;
    await tick();
    await generateChart();
    showToast('Loaded shared inputs and generated.');
  });

</script>

<div class="page-shell pb-12" id="esoteric-workbench">
  <div id="esoteric-chart-inputs" class="grid lg:grid-cols-3 gap-6">
    <div class="space-y-4 min-w-0">
      <ChartForm
        on:submit={generateChart}
        resultsReady={Boolean(apiResponse)}
        resultKey={chartResultKey}
        focusTargetId="esoteric-status"
        loading={loading}
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

      <EsotericSkyMapCard response={apiResponse} mode={activeMode} />

      <!-- Reports card removed per request -->
    </div>
  </div>
</div>
