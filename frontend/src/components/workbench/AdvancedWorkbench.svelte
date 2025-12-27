<script>
  import { get } from 'svelte/store';
  import { tick } from 'svelte';
  import { requestChartData, requestTransitRange } from '$lib/api/client';
  import { buildChartPayload, buildRangePayload } from '$lib/payloads';
  import { cacheStore, setCacheEntry } from '$lib/state/cacheStore';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import { rangeStore } from '$lib/state/rangeStore';
  import { animateCards } from '$lib/animations/pageTransitions';
  
  import StatusCard from '$components/shared/StatusCard.svelte';
  import AdvSummaryCard from '$components/advanced/AdvSummaryCard.svelte';
  import AdvAspectsCard from '$components/advanced/AdvAspectsCard.svelte';
  import AdvRangeCard from '$components/advanced/AdvRangeCard.svelte';
  import AdvSkyMapCard from '$components/advanced/AdvSkyMapCard.svelte';
  import AdvAscClockCard from '$components/advanced/AdvAscClockCard.svelte';
  import AdvMoonClockCard from '$components/advanced/AdvMoonClockCard.svelte';
  import AdvSunIngressCard from '$components/advanced/AdvSunIngressCard.svelte';
  import ChartForm from './ChartForm.svelte';

  const pageId = 'advanced';

  let status = '';
  let errorMessage = '';
  let apiResponse = null;
  let rangeResult = null;
  let loading = false;
  let rangeLoading = false;

  $: activeMode = $inputStore.mode;
  $: cached = $cacheStore.byPage?.[pageId]?.byMode?.[activeMode];
  $: if (cached) {
    const chartCache = cached.chart || {};

    apiResponse = chartCache.response || null;
  } else {
    apiResponse = null;
  }

  async function generateChart() {
    status = '';
    errorMessage = '';
    loading = true;
    const state = get(inputStore);
    const cfg = { ...get(configStore), asc_moon_sun_range_enabled: true, include_aspects: true };
    const { payload } = buildChartPayload(state.mode, state, cfg);
    try {
      const json = await requestChartData(state.mode, payload);
      apiResponse = json;
      setCacheEntry(pageId, state.mode, 'chart', { response: json });
      await tick();
      animateCards();
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
      const result = await requestTransitRange(payload);
      rangeResult = { ...result, granularity: payload.granularity };
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
  <div id="advanced-chart-inputs" class="grid lg:grid-cols-3 gap-6">
    <div class="space-y-4 min-w-0">
      <ChartForm on:submit={generateChart} />
      <StatusCard
        id="advanced-status"
        label="Status"
        statusText={status}
        errorMessage={errorMessage}
        loading={loading}
        ready={Boolean(apiResponse)}
      />
    </div>

    <div id="advanced-chart-results" class="lg:col-span-2 space-y-4 min-w-0">
      <AdvSummaryCard response={apiResponse} mode={activeMode} />

      <AdvSkyMapCard response={apiResponse} mode={activeMode} />

      <AdvAscClockCard response={apiResponse} mode={activeMode} />

      <AdvMoonClockCard response={apiResponse} mode={activeMode} />

      <AdvSunIngressCard response={apiResponse} mode={activeMode} />

      <AdvAspectsCard response={apiResponse} mode={activeMode} />

      <AdvRangeCard rangeResult={rangeResult} mode={activeMode} onRange={runRange} loading={rangeLoading} />
    </div>
  </div>
</div>
