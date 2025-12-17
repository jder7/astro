<script>
  import { get } from 'svelte/store';
  import { requestChart, requestChartPdf } from '$lib/api/client';
  import { buildChartPayload } from '$lib/payloads';
  import { cacheStore, setCacheEntry } from '$lib/state/cacheStore';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import { downloadBlob } from '$lib/utils/download';
  import SummaryCard from '$components/home/SummaryCard.svelte';
  import SvgCard from '$components/home/SvgCard.svelte';
  import ReportCard from '$components/home/ReportCard.svelte';
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
      const { json, svg } = await requestChart(state.mode, payload);
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
        {#if loading}
          <span class="badge">Working…</span>
        {:else if svgMarkup}
          <span class="badge">Ready</span>
        {/if}
      </div>
    </div>

    <div class="lg:col-span-2 space-y-6">
      <SummaryCard summary={cachedSummary} apiResponse={apiResponse} mode={activeMode} />

      <SvgCard svgMarkup={svgMarkup} loading={loading} mode={activeMode} />

      <ReportCard cachedReport={cachedReport} mode={activeMode} page={pageId} />
    </div>
  </div>
</div>
