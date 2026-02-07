<script>
  import { get } from 'svelte/store';
  import { tick } from 'svelte';
  import { requestChartData, requestTimeRangeSweeps, requestTransitRange } from '$lib/api/client';
  import { buildChartPayload, buildRangePayload, buildTimeRangeSweepsRequest } from '$lib/payloads';
  import { extractPointSignRanges } from '$lib/astro/advanced';
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
  import AdvPointIngressCard from '$components/advanced/AdvPointIngressCard.svelte';
  import ChartForm from './ChartForm.svelte';

  const pageId = 'advanced';

  let status = '';
  let errorMessage = '';
  let apiResponse = null;
  let timeRangeSweepsResponse = null;
  let rangeResult = null;
  let loading = false;
  let rangeLoading = false;
  let timeRangeSweepsLoading = { ascendant: false, moon: false, sun: false };
  let chartResultKey = 0;

  $: activeMode = $inputStore.mode;
  $: cached = $cacheStore.byPage?.[pageId]?.byMode?.[activeMode];
  $: if (cached) {
    const chartCache = cached.chart || {};

    apiResponse = chartCache.response || null;
    timeRangeSweepsResponse = chartCache.timeRangeSweeps || null;
  } else {
    apiResponse = null;
    timeRangeSweepsResponse = null;
  }

  const normalizePointKey = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]+/g, '');

  const hasTimeRangeSweep = (payload, target) => {
    const pointRanges = extractPointSignRanges(payload) || [];
    const targetKey = normalizePointKey(target);
    return pointRanges.some((range) => normalizePointKey(range.point_key || range.pointKey) === targetKey);
  };

  const mergePointRanges = (baseList, incomingList) => {
    const next = Array.isArray(baseList) ? [...baseList] : [];
    const incoming = Array.isArray(incomingList) ? incomingList : [];
    if (!incoming.length) return next;
    const indexByKey = new Map();
    next.forEach((range, idx) => {
      const key = `${normalizePointKey(range.point_key || range.pointKey)}:${range.id || range.label || idx}`;
      indexByKey.set(key, idx);
    });
    incoming.forEach((range, idx) => {
      const key = `${normalizePointKey(range.point_key || range.pointKey)}:${range.id || range.label || idx}`;
      const existingIdx = indexByKey.get(key);
      if (existingIdx == null) {
        next.push(range);
      } else {
        next[existingIdx] = range;
      }
    });
    return next;
  };

  const mergeTimeRangeSweeps = (base, incoming) => {
    if (!incoming) return base;
    const next = { ...(base || {}) };
    const incomingPointRanges = extractPointSignRanges(incoming) || [];
    if (incomingPointRanges.length) {
      const basePointRanges = extractPointSignRanges(base) || [];
      const merged = mergePointRanges(basePointRanges, incomingPointRanges);
      if (next.snapshot && typeof next.snapshot === 'object') {
        next.snapshot = { ...next.snapshot, pointSignRange: merged };
      } else {
        next.pointSignRange = merged;
      }
    }
    return next;
  };

  const mergeTimeRangeSweepsIntoResponse = (response, timeRangeSweeps) => {
    if (!response) return response;
    return mergeTimeRangeSweeps(response, timeRangeSweeps);
  };

  const setTimeRangeSweepsLoading = (targets, value) => {
    const updates = {};
    targets.forEach((target) => {
      updates[target] = value;
    });
    timeRangeSweepsLoading = { ...timeRangeSweepsLoading, ...updates };
  };

  const normalizeTargets = (targets) => {
    if (!targets) return [];
    return Array.isArray(targets) ? targets : [targets];
  };

  async function loadTimeRangeSweeps(targets, options = {}) {
    const requested = normalizeTargets(targets).filter(Boolean);
    if (!requested.length) return;
    const force = Boolean(options?.force);
    const pending = requested.filter(
      (target) => !timeRangeSweepsLoading[target] && (force || !hasTimeRangeSweep(timeRangeSweepsResponse, target))
    );
    if (!pending.length) return;

    setTimeRangeSweepsLoading(pending, true);
    try {
      const state = get(inputStore);
      const cfg = get(configStore);
      const payload = buildTimeRangeSweepsRequest(state.mode, state, cfg, pending);
      const result = await requestTimeRangeSweeps(payload);
      timeRangeSweepsResponse = mergeTimeRangeSweeps(timeRangeSweepsResponse, result);
      setCacheEntry(pageId, state.mode, 'chart', { timeRangeSweeps: timeRangeSweepsResponse });
    } catch (err) {
      console.warn('Time range sweeps request failed', err);
    } finally {
      setTimeRangeSweepsLoading(pending, false);
    }
  }

  $: responseWithTimeRangeSweeps = mergeTimeRangeSweepsIntoResponse(apiResponse, timeRangeSweepsResponse);

  async function generateChart() {
    status = '';
    errorMessage = '';
    loading = true;
    const state = get(inputStore);
    const cfg = { ...get(configStore), asc_moon_sun_range_enabled: false, include_aspects: true };
    timeRangeSweepsResponse = null;
    timeRangeSweepsLoading = { ascendant: false, moon: false, sun: false };
    rangeResult = null;
    const { payload } = buildChartPayload(state.mode, state, cfg);
    try {
      const json = await requestChartData(state.mode, payload);
      apiResponse = json;
      setCacheEntry(pageId, state.mode, 'chart', { response: json, timeRangeSweeps: null });
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

  async function runRange(event) {
    if (event?.preventDefault) event.preventDefault();
    rangeLoading = true;
    status = '';
    errorMessage = '';
    try {
      const state = get(inputStore);
      const cfg = { ...get(configStore), asc_moon_sun_range_enabled: false, include_aspects: true };
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
      <ChartForm
        on:submit={generateChart}
        resultsReady={Boolean(apiResponse)}
        resultKey={chartResultKey}
        focusTargetId="advanced-status"
        loading={loading}
      />
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
      <AdvSummaryCard response={responseWithTimeRangeSweeps} mode={activeMode} resultKey={chartResultKey} />

      <AdvSkyMapCard
        response={responseWithTimeRangeSweeps}
        mode={activeMode}
        loading={timeRangeSweepsLoading.sun}
        onRequestTimeRangeSweeps={loadTimeRangeSweeps}
      />

      {#if activeMode !== 'relationship'}
        <AdvAscClockCard
          response={responseWithTimeRangeSweeps}
          mode={activeMode}
          loading={timeRangeSweepsLoading.ascendant}
          onRequestTimeRangeSweeps={loadTimeRangeSweeps}
        />

        <AdvMoonClockCard
          response={responseWithTimeRangeSweeps}
          mode={activeMode}
          loading={timeRangeSweepsLoading.moon}
          onRequestTimeRangeSweeps={loadTimeRangeSweeps}
        />

        <AdvPointIngressCard
          response={responseWithTimeRangeSweeps}
          mode={activeMode}
          loadingMap={timeRangeSweepsLoading}
          onRequestTimeRangeSweeps={loadTimeRangeSweeps}
        />
      {/if}

      <AdvAspectsCard response={responseWithTimeRangeSweeps} mode={activeMode} />

      {#if activeMode !== 'relationship'}
        <AdvRangeCard rangeResult={rangeResult} mode={activeMode} onRange={runRange} loading={rangeLoading} />
      {/if}
    </div>
  </div>
</div>
