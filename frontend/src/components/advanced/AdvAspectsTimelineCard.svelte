<script>
  import { get } from 'svelte/store';
  import { onDestroy, tick } from 'svelte';
  import { requestAspectSpans, requestKinematicAspectSpans } from '$lib/api/client';
  import { buildRangePayload } from '$lib/payloads';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import {
    buildTimelineCacheKey,
    getMemoizedTimelineSpans,
    getTimelineCacheEntry,
    setTimelineCacheEntry,
  } from '$lib/astro/timeline/cache';
  import { normalizeBackendSpans, presetToRange, RANGE_PRESETS, spanSpeedClass } from '$lib/astro/timeline/spans';
  import { copyToClipboard } from '$lib/utils/download';

  import AdvAspectsTimelineControls from './AdvAspectsTimelineControls.svelte';
  import AdvAspectsTimeline from './AdvAspectsTimeline.svelte';
  import AdvAspectsTimelineDetails from './AdvAspectsTimelineDetails.svelte';
  import AspectCopyButton from '$components/shared/AspectCopyButton.svelte';
  import ZoomEntryButton from '$components/shared/ZoomEntryButton.svelte';

  export let mode = 'natal';

  let collapsed = true;
  let loading = false;
  let errorMsg = '';
  let activePreset = '1M';
  let spans = [];
  let viewStart = 0;
  let viewEnd = 0;
  let selectedSpan = null;
  let isFullscreen = false;
  let fullscreenEl = null;
  let detailsRegionEl = null;
  let lastFocusedEl = null;
  let hasLoaded = false;
  let requestSeq = 0;
  let loadedMode = mode;
  let requestTimeMs = NaN;
  let requestReferenceTs = NaN;
  let spanEngine = 'kinematic';
  let timelineCopyState = 'idle';
  let timelineCopyTimer = null;

  const pendingTimelineRequests = new Map();

  // Filter state
  let focusFilter = 'all';
  let selectedAspectTypes = [];
  let selectedPoints = [];
  let searchFilter = '';
  let movementFilter = 'both';
  let groupBy = 'planet';

  // Derive base date from inputStore transit moment
  const getBaseDate = () => {
    const state = get(inputStore);
    const transit = state?.transit;
    if (transit) {
      const d = new Date(transit.year, (transit.month || 1) - 1, transit.day || 1, transit.hour || 12, transit.minute || 0);
      if (Number.isFinite(d.getTime())) return d;
    }
    return new Date();
  };

  // Draggable pin position (ms timestamp)
  let pinTs = getBaseDate().getTime();

  const parseRangeTs = (parts) => {
    const d = new Date(parts.year, (parts.month || 1) - 1, parts.day || 1, parts.hour || 0, parts.minute || 0);
    return d.getTime();
  };
  const matchesMovement = (span) => {
    if (movementFilter === 'both') return true;
    const movement = String(span.movementStart || '').toLowerCase();
    return movementFilter === 'applying' ? movement.includes('applying') : movement.includes('separating');
  };

  const matchesSearch = (span) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return span.left.toLowerCase().includes(q) || span.right.toLowerCase().includes(q) || span.aspectType.toLowerCase().includes(q);
  };
  const normalizeAspect = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  const normalizePoint = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  const matchesAspectType = (span) =>
    !selectedAspectTypes.length ||
    selectedAspectTypes.map(normalizeAspect).includes(normalizeAspect(span.aspectType));
  const matchesPointSelection = (span) => {
    if (!selectedPoints.length) return true;
    const pointSet = new Set(selectedPoints.map(normalizePoint));
    return pointSet.has(normalizePoint(span.left)) && pointSet.has(normalizePoint(span.right));
  };

  const matchesActiveFilters = (span) => {
    if (focusFilter !== 'all' && spanSpeedClass(span) !== focusFilter) return false;
    if (!matchesAspectType(span)) return false;
    if (!matchesPointSelection(span)) return false;
    if (!matchesMovement(span)) return false;
    if (!matchesSearch(span)) return false;
    return true;
  };

  const hydrateTimelineResult = (result, cacheKey, memoToken = '') => {
    const rawSpans = Array.isArray(result?.spans) ? result.spans : [];
    const memoKey = `${cacheKey || 'uncached'}:${memoToken || rawSpans.length}`;
    spans = getMemoizedTimelineSpans(memoKey, rawSpans, normalizeBackendSpans);
  };

  async function fetchSpanWindow({ start, end, granularity, viewStartNext, viewEndNext, resetSelection = false, setDefaultPin = false, referenceTs = NaN, presetKey = activePreset }) {
    if (!start || !end) return;
    const requestStart = parseRangeTs(start);
    const requestEnd = parseRangeTs(end);
    if (!Number.isFinite(requestStart) || !Number.isFinite(requestEnd)) return;

    errorMsg = '';
    if (resetSelection) selectedSpan = null;
    const seq = ++requestSeq;
    const startedAt = performance.now();
    requestReferenceTs = referenceTs;

    try {
      const state = get(inputStore);
      const cfg = { ...get(configStore), asc_moon_sun_range_enabled: false, include_aspects: true };
      const payload = buildRangePayload(
        state,
        cfg,
        { start, end, granularity, include_aspects: true },
        mode !== 'transit',
      );
      payload.mode = mode === 'natal_transit' ? 'natal_transit' : 'transit';

      const { key: cacheKey, fingerprint } = buildTimelineCacheKey({
        state,
        payload,
        mode: payload.mode,
        engine: spanEngine,
        presetKey,
      });
      const cachedEntry = getTimelineCacheEntry(payload.mode, cacheKey);
      if (cachedEntry?.response) {
        if (seq !== requestSeq) return;
        hydrateTimelineResult(cachedEntry.response, cacheKey, cachedEntry.createdAt);
        requestTimeMs = Number(cachedEntry.requestTimeMs);
        requestReferenceTs = Number.isFinite(cachedEntry.referenceTs) ? cachedEntry.referenceTs : referenceTs;
        hasLoaded = true;
        viewStart = viewStartNext;
        viewEnd = viewEndNext;
        if (setDefaultPin) pinTs = Math.max(viewStart, Math.min(viewEnd, getBaseDate().getTime()));
        loading = false;
        return;
      }

      loading = true;
      const requestFn = spanEngine === 'kinematic' ? requestKinematicAspectSpans : requestAspectSpans;
      let requestPromise = pendingTimelineRequests.get(cacheKey);
      if (!requestPromise) {
        requestPromise = requestFn(payload).finally(() => pendingTimelineRequests.delete(cacheKey));
        pendingTimelineRequests.set(cacheKey, requestPromise);
      }
      const result = await requestPromise;
      if (seq !== requestSeq) return;
      requestTimeMs = performance.now() - startedAt;
      const createdAt = Date.now();
      hydrateTimelineResult(result, cacheKey, createdAt);
      setTimelineCacheEntry(payload.mode, cacheKey, {
        fingerprint,
        preset: presetKey,
        engine: spanEngine,
        mode: payload.mode,
        referenceTs,
        requestTimeMs,
        response: result,
      });
      hasLoaded = true;

      viewStart = viewStartNext;
      viewEnd = viewEndNext;
      if (setDefaultPin) pinTs = Math.max(viewStart, Math.min(viewEnd, getBaseDate().getTime()));
    } catch (err) {
      if (seq !== requestSeq) return;
      requestTimeMs = performance.now() - startedAt;
      errorMsg = err?.message || 'Failed to load range data.';
      spans = [];
    } finally {
      if (seq === requestSeq) loading = false;
    }
  }

  async function fetchRange(presetKey) {
    const baseDate = getBaseDate();
    const preset = presetToRange(presetKey, baseDate);
    if (!preset) return;

    const initialViewStart = parseRangeTs(preset.start);
    const initialViewEnd = parseRangeTs(preset.end);
    await fetchSpanWindow({
      start: preset.start,
      end: preset.end,
      granularity: preset.granularity,
      viewStartNext: initialViewStart,
      viewEndNext: initialViewEnd,
      resetSelection: true,
      setDefaultPin: true,
      referenceTs: baseDate.getTime(),
    });
  }

  const handlePresetChange = (key) => {
    activePreset = key;
    hasLoaded = false;
    fetchRange(key);
  };

  const handleEngineChange = (engine) => {
    spanEngine = engine === 'kinematic' ? 'kinematic' : 'scan';
    hasLoaded = false;
    fetchRange(activePreset);
  };

  const handleToggleCollapsed = () => {
    collapsed = !collapsed;
    if (!collapsed && !hasLoaded && !loading) fetchRange(activePreset);
  };

  const handleFilterChange = (filters) => {
    focusFilter = filters.focusFilter;
    selectedAspectTypes = Array.isArray(filters.selectedAspectTypes) ? filters.selectedAspectTypes : [];
    selectedPoints = Array.isArray(filters.selectedPoints) ? filters.selectedPoints : [];
    searchFilter = filters.searchFilter;
    movementFilter = filters.movementFilter;
    groupBy = filters.groupBy;
  };

  const handleViewChange = (start, end) => {
    const currentRange = viewEnd - viewStart;
    const nextRange = end - start;
    const pinFraction = currentRange > 0 && pinTs >= viewStart && pinTs <= viewEnd
      ? (pinTs - viewStart) / currentRange
      : 0.5;
    viewStart = start;
    viewEnd = end;
    if (Number.isFinite(nextRange) && nextRange > 0) {
      pinTs = Math.max(viewStart, Math.min(viewEnd, viewStart + pinFraction * nextRange));
    }
  };

  const handleSelectSpan = (span) => {
    selectedSpan = span;
    if (span && (!Number.isFinite(pinTs) || pinTs < span.startAt || pinTs > span.endAt)) {
      pinTs = span.exactAt;
    }
    tick().then(() => detailsRegionEl?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
  };

  const handlePinMove = (ts) => {
    pinTs = ts;
  };

  const formatCopyTs = (ms) => {
    if (!Number.isFinite(ms)) return '—';
    try {
      return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
    }
  };

  const resetTimelineCopyStateSoon = () => {
    if (timelineCopyTimer) clearTimeout(timelineCopyTimer);
    timelineCopyTimer = setTimeout(() => {
      timelineCopyState = 'idle';
      timelineCopyTimer = null;
    }, 1800);
  };

  const buildTimelineCopyText = () => {
    const windowLabel = `${formatCopyTs(viewStart)} -> ${formatCopyTs(viewEnd)}`;
    const peakRows = nextPeaks.map((span, index) => (
      `${index + 1}. ${span.left} ${span.aspectType} ${span.right} — approx exact ${formatCopyTs(span.exactAt)}`
    ));
    const rows = filteredVisibleWindowSpans.map((span, index) => {
      const clippedStart = Math.max(span.startAt, viewStart);
      const clippedEnd = Math.min(span.endAt, viewEnd);
      return [
        `${index + 1}. ${span.left} ${span.aspectType} ${span.right}`,
        `   Aspect: ${span.aspectType}`,
        `   Points: ${span.left} / ${span.right}`,
        `   Start: ${formatCopyTs(clippedStart)}`,
        `   End: ${formatCopyTs(clippedEnd)}`,
        `   Approx exact: ${formatCopyTs(span.exactAt)}`,
      ].join('\n');
    });
    return [
      `Aspects Timeline`,
      `Window: ${windowLabel}`,
      '',
      `Next peaks`,
      ...(peakRows.length ? peakRows : ['None']),
      '',
      `Visible filtered aspects`,
      ...rows,
    ].join('\n');
  };

  const copyVisibleTimelineAspects = async () => {
    if (!filteredVisibleWindowSpans.length) return;
    const ok = await copyToClipboard(buildTimelineCopyText());
    timelineCopyState = ok ? 'copied' : 'error';
    resetTimelineCopyStateSoon();
  };

  // Jump actions
  const jumpToNow = () => {
    const now = Date.now();
    const halfRange = (viewEnd - viewStart) / 2;
    viewStart = now - halfRange;
    viewEnd = now + halfRange;
    pinTs = now;
  };

  const jumpToNextExact = (direction = 1) => {
    const reference = pinTs || ((viewStart + viewEnd) / 2) || Date.now();
    const candidates = spans
      .filter((s) => matchesActiveFilters(s))
      .filter((s) => (direction > 0 ? s.exactAt > reference : s.exactAt < reference))
      .sort((a, b) => direction > 0 ? a.exactAt - b.exactAt : b.exactAt - a.exactAt);
    if (!candidates.length) return;
    const target = candidates[0].exactAt;
    const halfRange = (viewEnd - viewStart) / 2;
    viewStart = target - halfRange;
    viewEnd = target + halfRange;
    pinTs = target;
    selectedSpan = candidates[0];
  };

  // Fullscreen toggle
  const copyThemeVars = (node) => {
    if (typeof document === 'undefined') return;
    const themeSource = document.getElementById('app-shell') || document.documentElement;
    const styles = getComputedStyle(themeSource);
    ['--accent', '--accent-strong', '--accent-soft', '--badge-bg', '--badge-border', '--badge-text'].forEach((name) => {
      const value = styles.getPropertyValue(name);
      if (value) node.style.setProperty(name, value.trim());
    });
  };

  function portal(node) {
    copyThemeVars(node);
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      },
    };
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      lastFocusedEl = document.activeElement;
      isFullscreen = true;
      tick().then(() => fullscreenEl?.focus());
    } else {
      closeFullscreen();
    }
  };

  const closeFullscreen = () => {
    isFullscreen = false;
    tick().then(() => lastFocusedEl?.focus?.());
  };

  // Keyboard handler for fullscreen escape
  const handleFsKey = (e) => {
    if (e.key === 'Escape' && isFullscreen) closeFullscreen();
  };

  $: aspectTypes = Array.from(new Set(spans.map((span) => span.aspectType).filter(Boolean)))
    .sort((a, b) => String(a).localeCompare(String(b)));
  $: pointOptions = Array.from(new Set(spans.flatMap((span) => [span.left, span.right]).filter(Boolean)))
    .sort((a, b) => String(a).localeCompare(String(b)));
  $: selectedAspectSet = new Set(selectedAspectTypes.map(normalizeAspect));
  $: selectedPointSet = new Set(selectedPoints.map(normalizePoint));
  $: searchQuery = searchFilter.trim().toLowerCase();
  $: filteredTimelineSpans = spans.filter((span) => {
    if (focusFilter !== 'all' && spanSpeedClass(span) !== focusFilter) return false;
    if (selectedAspectSet.size && !selectedAspectSet.has(normalizeAspect(span.aspectType))) return false;
    if (
      selectedPointSet.size &&
      !(selectedPointSet.has(normalizePoint(span.left)) && selectedPointSet.has(normalizePoint(span.right)))
    ) return false;
    if (movementFilter !== 'both') {
      const movement = String(span.movementStart || '').toLowerCase();
      const movementMatches = movementFilter === 'applying'
        ? movement.includes('applying')
        : movement.includes('separating');
      if (!movementMatches) return false;
    }
    if (
      searchQuery &&
      !span.left.toLowerCase().includes(searchQuery) &&
      !span.right.toLowerCase().includes(searchQuery) &&
      !span.aspectType.toLowerCase().includes(searchQuery)
    ) return false;
    return true;
  });
  $: nextPeaks = (() => {
    if (!filteredTimelineSpans.length) return [];
    const reference = pinTs || ((viewStart + viewEnd) / 2) || Date.now();
    return filteredTimelineSpans
      .filter((span) => span.exactAt >= reference)
      .sort((a, b) => a.exactAt - b.exactAt)
      .slice(0, 3);
  })();
  $: filteredVisibleWindowSpans = filteredTimelineSpans
    .filter((span) => span.endAt >= viewStart && span.startAt <= viewEnd)
    .sort((a, b) => a.startAt - b.startAt || a.exactAt - b.exactAt);
  $: timelineCopyTitle = timelineCopyState === 'copied'
    ? 'Copied filtered visible timeline aspects'
    : timelineCopyState === 'error'
      ? 'Copy failed'
      : `Copy ${filteredVisibleWindowSpans.length} filtered visible timeline aspect${filteredVisibleWindowSpans.length === 1 ? '' : 's'}`;

  const jumpToSpan = (span) => {
    if (!span) return;
    const halfRange = Math.max((viewEnd - viewStart) / 2, 3_600_000);
    viewStart = span.exactAt - halfRange;
    viewEnd = span.exactAt + halfRange;
    pinTs = span.exactAt;
    selectedSpan = span;
  };

  const zoomViewport = (factor) => {
    const center = (viewStart + viewEnd) / 2;
    const halfRange = ((viewEnd - viewStart) / 2) * factor;
    if (halfRange * 2 < 7_200_000) return;
    handleViewChange(center - halfRange, center + halfRange);
  };

  $: if (mode !== loadedMode) {
    loadedMode = mode;
    hasLoaded = false;
    spans = [];
    selectedSpan = null;
    if (!collapsed && !loading) fetchRange(activePreset);
  }

  onDestroy(() => {
    if (timelineCopyTimer) clearTimeout(timelineCopyTimer);
  });
</script>

<svelte:window on:keydown={handleFsKey} />

<div class="flowbite-card space-y-4" id="adv-aspects-timeline-panel">
  <div class="card-head card-head-inline">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Temporal Vision</p>
      <h2>Aspects Timeline</h2>
    </div>
    <div class="card-head-actions">
      {#if spans.length}
        <span class="badge">{spans.length} spans</span>
      {/if}
      <button
        type="button"
        class="icon-button"
        on:click={handleToggleCollapsed}
        aria-expanded={!collapsed}
        aria-controls="adv-timeline-body"
        aria-label={collapsed ? 'Expand timeline' : 'Collapse timeline'}
      >
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
        </svg>
      </button>
    </div>
  </div>

  {#if !collapsed}
    <div id="adv-timeline-body" class="space-y-4">
      <AdvAspectsTimelineControls
        instanceId="inline"
        {activePreset}
        {focusFilter}
        {selectedAspectTypes}
        {aspectTypes}
        {selectedPoints}
        {pointOptions}
        {searchFilter}
        {movementFilter}
        {groupBy}
        {loading}
        spanCount={spans.length}
        {requestTimeMs}
        {requestReferenceTs}
        {spanEngine}
        onPresetChange={handlePresetChange}
        onEngineChange={handleEngineChange}
        onFilterChange={handleFilterChange}
      />

      {#if errorMsg}
        <p class="text-sm text-rose-400">{errorMsg}</p>
      {/if}

      {#if loading}
        <div class="timeline-loading">
          <div class="loading-bar"></div>
          <p class="text-xs text-slate-400">Calculating aspects across {RANGE_PRESETS[activePreset]?.label || 'range'}…</p>
        </div>
      {/if}

      <div class="timeline-actions">
        <button type="button" class="action-btn" on:click={jumpToNow} disabled={!spans.length || loading} title="Jump to now">
          <span aria-hidden="true">⏐</span> Now
        </button>
        <button type="button" class="action-btn" on:click={() => jumpToNextExact(-1)} disabled={!spans.length || loading} title="Previous exact">
          ← Prev exact
        </button>
        <button type="button" class="action-btn" on:click={() => jumpToNextExact(1)} disabled={!spans.length || loading} title="Next exact">
          Next exact →
        </button>
        <AspectCopyButton
          onClick={copyVisibleTimelineAspects}
          disabled={!filteredVisibleWindowSpans.length || loading}
          title={timelineCopyTitle}
          state={timelineCopyState}
        />
        <ZoomEntryButton onClick={toggleFullscreen} disabled={!spans.length || loading} title="Expand fullscreen" ariaLabel="Expand fullscreen" alignEnd={true} />
      </div>

      {#if nextPeaks.length}
        <div class="timeline-peak-rail" aria-label="Upcoming exact aspects">
          <span class="rail-label">Next peaks</span>
          {#each nextPeaks as peak}
            <button type="button" class="peak-btn" on:click={() => jumpToSpan(peak)} title="Jump to exact aspect" disabled={loading}>
              <span>{peak.left}</span>
              <strong>{peak.aspectType}</strong>
              <span>{peak.right}</span>
            </button>
          {/each}
        </div>
      {/if}

      <AdvAspectsTimeline
        {spans}
        {viewStart}
        {viewEnd}
        {groupBy}
        {activePreset}
        {focusFilter}
        selectedAspectTypes={selectedAspectTypes}
        selectedPoints={selectedPoints}
        {searchFilter}
        {movementFilter}
        {selectedSpan}
        {pinTs}
        frozen={loading}
        onSelectSpan={handleSelectSpan}
        onViewChange={handleViewChange}
        onPinMove={handlePinMove}
      />

      <div id="advanced-aspects-timeline-details-region" class="timeline-details-region" bind:this={detailsRegionEl}>
        <AdvAspectsTimelineDetails
          span={selectedSpan}
          {viewStart}
          {viewEnd}
          {pinTs}
          onClose={() => (selectedSpan = null)}
        />
      </div>
    </div>
  {/if}
</div>

<!-- Fullscreen portal -->
{#if isFullscreen}
  <div class="timeline-fullscreen" use:portal bind:this={fullscreenEl} on:keydown={handleFsKey} role="dialog" aria-label="Fullscreen aspects timeline" tabindex="-1">
    <div class="fs-header">
      <h3 class="fs-title">Aspects Timeline</h3>
      <div class="fs-actions">
        <div class="zoom-btns fs-zoom-btns" aria-label="Timeline zoom controls">
          <button type="button" class="timeline-zoom-button timeline-zoom-button--in" on:click={() => zoomViewport(0.7)} title="Zoom in" disabled={!spans.length || loading}>+</button>
          <button type="button" class="timeline-zoom-button timeline-zoom-button--out" on:click={() => zoomViewport(1.4)} title="Zoom out" disabled={!spans.length || loading}>−</button>
        </div>
        <button type="button" class="action-btn" on:click={jumpToNow} disabled={!spans.length || loading} title="Jump to now">⏐ Now</button>
        <button type="button" class="action-btn" on:click={() => jumpToNextExact(-1)} disabled={!spans.length || loading} title="Previous exact">← Prev</button>
        <button type="button" class="action-btn" on:click={() => jumpToNextExact(1)} disabled={!spans.length || loading} title="Next exact">Next →</button>
        <AspectCopyButton
          onClick={copyVisibleTimelineAspects}
          disabled={!filteredVisibleWindowSpans.length || loading}
          title={timelineCopyTitle}
          state={timelineCopyState}
        />
        <button type="button" class="fs-close" on:click={closeFullscreen} aria-label="Exit fullscreen">✕</button>
      </div>
    </div>

    <div class="fs-controls">
      <AdvAspectsTimelineControls
        instanceId="fullscreen"
        {activePreset}
        {focusFilter}
        {selectedAspectTypes}
        {aspectTypes}
        {selectedPoints}
        {pointOptions}
        {searchFilter}
        {movementFilter}
        {groupBy}
        {loading}
        spanCount={spans.length}
        {requestTimeMs}
        {requestReferenceTs}
        {spanEngine}
        onPresetChange={handlePresetChange}
        onEngineChange={handleEngineChange}
        onFilterChange={handleFilterChange}
      />
    </div>

    {#if nextPeaks.length}
      <div class="fs-peak-rail">
        <div class="timeline-peak-rail" aria-label="Upcoming exact aspects">
          <span class="rail-label">Next peaks</span>
          {#each nextPeaks as peak}
            <button type="button" class="peak-btn" on:click={() => jumpToSpan(peak)} title="Jump to exact aspect" disabled={loading}>
              <span>{peak.left}</span>
              <strong>{peak.aspectType}</strong>
              <span>{peak.right}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="fs-body">
      <AdvAspectsTimeline
        {spans}
        {viewStart}
        {viewEnd}
        {groupBy}
        {activePreset}
        {focusFilter}
        selectedAspectTypes={selectedAspectTypes}
        selectedPoints={selectedPoints}
        {searchFilter}
        {movementFilter}
        {selectedSpan}
        {pinTs}
        frozen={loading}
        onSelectSpan={handleSelectSpan}
        onViewChange={handleViewChange}
        onPinMove={handlePinMove}
      />
    </div>

    {#if selectedSpan}
      <div class="fs-details">
        <div id="advanced-aspects-timeline-fullscreen-details-region" class="timeline-details-region" bind:this={detailsRegionEl}>
          <AdvAspectsTimelineDetails
            span={selectedSpan}
            {viewStart}
            {viewEnd}
            {pinTs}
            onClose={() => (selectedSpan = null)}
          />
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .timeline-loading {
    padding: 20px;
    text-align: center;
  }
  .loading-bar {
    width: 120px;
    height: 3px;
    margin: 0 auto 8px;
    border-radius: 2px;
    background: linear-gradient(90deg, transparent, var(--accent, #06b6d4), transparent);
    animation: shimmer 1.2s ease-in-out infinite;
  }
  @keyframes shimmer {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
  .timeline-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 34px;
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    color: color-mix(in srgb, var(--accent, #06b6d4) 18%, #e2e8f0 82%);
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 24%, rgba(15, 23, 42, 0.68));
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 18%, #1e293b 82%);
    border-radius: 12px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .action-btn:hover:not(:disabled) {
    color: #f8fafc;
    border-color: color-mix(in srgb, var(--accent, #06b6d4) 42%, #334155 58%);
    background: var(--accent-soft, rgba(14, 165, 233, 0.12));
  }
  .action-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent, #06b6d4);
  }
  .action-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .timeline-peak-rail {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 14%, #1e293b 86%);
    border-radius: 8px;
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 12%, rgba(15, 23, 42, 0.45));
  }
  .rail-label {
    font-size: 11px;
    font-weight: 700;
    color: color-mix(in srgb, var(--accent, #06b6d4) 18%, #94a3b8 82%);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .peak-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 220px;
    padding: 5px 8px;
    border-radius: 7px;
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 18%, #1e293b 82%);
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 32%, rgba(15, 23, 42, 0.56));
    color: #cbd5e1;
    font-size: 11px;
    cursor: pointer;
  }
  .peak-btn span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .peak-btn strong {
    color: color-mix(in srgb, var(--accent, #06b6d4) 55%, #f8fafc 45%);
    font-weight: 700;
  }
  .peak-btn:hover {
    border-color: color-mix(in srgb, var(--accent, #06b6d4) 45%, #334155 55%);
    color: #f8fafc;
  }

  /* Fullscreen overlay */
  .timeline-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #0a101c;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .fs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    flex-shrink: 0;
  }
  .fs-title {
    font-size: 16px;
    font-weight: 700;
    color: #e2e8f0;
  }
  .fs-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .zoom-btns {
    display: inline-flex;
    gap: 2px;
  }
  .zoom-btns button {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 18%, #1e293b 82%);
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 24%, rgba(15, 23, 42, 0.85));
    color: color-mix(in srgb, var(--accent, #06b6d4) 18%, #cbd5e1 82%);
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .zoom-btns button:hover:not(:disabled) {
    color: #f8fafc;
    border-color: color-mix(in srgb, var(--accent, #06b6d4) 45%, #334155 55%);
    background: var(--accent-soft, rgba(14, 165, 233, 0.12));
  }
  .zoom-btns button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .fs-close {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 18%, #1e293b 82%);
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 24%, rgba(15, 23, 42, 0.68));
    color: color-mix(in srgb, var(--accent, #06b6d4) 18%, #cbd5e1 82%);
    font-size: 16px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, border-color 0.15s;
  }
  .fs-close:hover {
    color: #f8fafc;
    border-color: color-mix(in srgb, var(--accent, #06b6d4) 42%, #334155 58%);
    background: var(--accent-soft, rgba(14, 165, 233, 0.12));
  }
  .fs-controls {
    padding: 10px 20px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.06);
    flex-shrink: 0;
  }
  .fs-peak-rail {
    padding: 8px 20px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.06);
    flex-shrink: 0;
  }
  .fs-body {
    flex: 1;
    overflow: auto;
    padding: 0 20px;
  }
  .fs-details {
    padding: 12px 20px;
    border-top: 1px solid rgba(148, 163, 184, 0.1);
    flex-shrink: 0;
    max-height: 200px;
    overflow-y: auto;
  }
</style>
