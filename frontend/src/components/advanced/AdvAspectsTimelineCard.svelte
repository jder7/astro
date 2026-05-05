<script>
  import { get } from 'svelte/store';
  import { tick } from 'svelte';
  import { requestAspectSpans, requestKinematicAspectSpans } from '$lib/api/client';
  import { buildRangePayload } from '$lib/payloads';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import { normalizeBackendSpans, presetToRange, RANGE_PRESETS, spanSpeedClass, isVeryFastSpanForRange } from '$lib/astro/timeline/spans';

  import AdvAspectsTimelineControls from './AdvAspectsTimelineControls.svelte';
  import AdvAspectsTimeline from './AdvAspectsTimeline.svelte';
  import AdvAspectsTimelineDetails from './AdvAspectsTimelineDetails.svelte';

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

  // Filter state
  let focusFilter = 'all';
  let aspectFilter = 'all';
  let orbLimit = 3;
  let searchFilter = '';
  let movementFilter = 'both';
  let groupBy = 'planet';
  let hideVeryFast = false;

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
  const DAY_MS = 86_400_000;

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
  const matchesAspectType = (span) => aspectFilter === 'all' || normalizeAspect(span.aspectType) === normalizeAspect(aspectFilter);

  const matchesActiveFilters = (span) => {
    if (Number.isFinite(span.minOrb) && span.minOrb > orbLimit) return false;
    if (focusFilter !== 'all' && spanSpeedClass(span) !== focusFilter) return false;
    if (!matchesAspectType(span)) return false;
    if (hideVeryFast && isVeryFastSpanForRange(span, viewEnd - viewStart)) return false;
    if (!matchesMovement(span)) return false;
    if (!matchesSearch(span)) return false;
    return true;
  };

  async function fetchSpanWindow({ start, end, granularity, viewStartNext, viewEndNext, resetSelection = false, setDefaultPin = false, referenceTs = NaN }) {
    if (!start || !end) return;
    const requestStart = parseRangeTs(start);
    const requestEnd = parseRangeTs(end);
    if (!Number.isFinite(requestStart) || !Number.isFinite(requestEnd)) return;

    loading = true;
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

      const requestFn = spanEngine === 'kinematic' ? requestKinematicAspectSpans : requestAspectSpans;
      const result = await requestFn(payload);
      if (seq !== requestSeq) return;
      requestTimeMs = performance.now() - startedAt;
      spans = normalizeBackendSpans(result?.spans);
      console.debug('[AdvAspectsTimelineCard][aspect-spans-response]', {
        engine: result?.engine || spanEngine,
        rawCount: Array.isArray(result?.spans) ? result.spans.length : 0,
        normalizedCount: spans.length,
        timestampsEvaluated: result?.timestamps_evaluated,
        passParents: spans
          .filter((span) => span.passes?.length)
          .map((span) => ({
            id: span.id,
            label: `${span.left} ${span.aspectType} ${span.right}`,
            startAt: new Date(span.startAt).toISOString(),
            endAt: new Date(span.endAt).toISOString(),
            passCount: span.passes.length,
            exacts: span.passes.map((pass) => new Date(pass.exactAt).toISOString().slice(0, 10)),
          })),
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
    hideVeryFast = preset.days > 1;
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
    aspectFilter = filters.aspectFilter;
    orbLimit = filters.orbLimit;
    searchFilter = filters.searchFilter;
    movementFilter = filters.movementFilter;
    groupBy = filters.groupBy;
    hideVeryFast = filters.hideVeryFast;
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
    if ((end - start) > DAY_MS) hideVeryFast = true;
  };

  const handleSelectSpan = (span) => {
    selectedSpan = span;
    tick().then(() => detailsRegionEl?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
  };

  const handlePinMove = (ts) => {
    pinTs = ts;
  };

  // Jump actions
  const jumpToNow = () => {
    const now = Date.now();
    const halfRange = (viewEnd - viewStart) / 2;
    viewStart = now - halfRange;
    viewEnd = now + halfRange;
    pinTs = now;
    if ((viewEnd - viewStart) > DAY_MS) hideVeryFast = true;
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
    if ((viewEnd - viewStart) > DAY_MS) hideVeryFast = true;
    selectedSpan = candidates[0];
  };

  // Fullscreen toggle
  function portal(node) {
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

  $: hiddenCount = (() => {
    if (!spans.length || !hideVeryFast) return 0;
    const viewMs = viewEnd - viewStart;
    const days = viewMs / DAY_MS;
    if (days <= 1) return 0;
    return spans.filter((span) => {
      if (!isVeryFastSpanForRange(span, viewMs)) return false;
      if (Number.isFinite(span.minOrb) && span.minOrb > orbLimit) return false;
      if (focusFilter !== 'all' && spanSpeedClass(span) !== focusFilter) return false;
      if (!matchesAspectType(span)) return false;
      if (!matchesMovement(span)) return false;
      if (!matchesSearch(span)) return false;
      return true;
    }).length;
  })();

  $: nextPeaks = (() => {
    if (!spans.length) return [];
    const reference = pinTs || ((viewStart + viewEnd) / 2) || Date.now();
    return spans
      .filter((span) => matchesActiveFilters(span) && span.exactAt >= reference)
      .sort((a, b) => a.exactAt - b.exactAt)
      .slice(0, 3);
  })();

  $: aspectTypes = Array.from(new Set(spans.map((span) => span.aspectType).filter(Boolean)))
    .sort((a, b) => String(a).localeCompare(String(b)));

  const jumpToSpan = (span) => {
    if (!span) return;
    const halfRange = Math.max((viewEnd - viewStart) / 2, 3_600_000);
    viewStart = span.exactAt - halfRange;
    viewEnd = span.exactAt + halfRange;
    if ((viewEnd - viewStart) > DAY_MS) hideVeryFast = true;
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
        class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition"
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
        {aspectFilter}
        {aspectTypes}
        {orbLimit}
        {searchFilter}
        {movementFilter}
        {groupBy}
        {hideVeryFast}
        {loading}
        spanCount={spans.length}
        {hiddenCount}
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
        <button type="button" class="action-btn action-btn--expand" on:click={toggleFullscreen} disabled={!spans.length || loading} title="Expand fullscreen">
          ⛶
        </button>
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
        {aspectFilter}
        {orbLimit}
        {searchFilter}
        {movementFilter}
        {hideVeryFast}
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
        <button type="button" class="fs-close" on:click={closeFullscreen} aria-label="Exit fullscreen">✕</button>
      </div>
    </div>

    <div class="fs-controls">
      <AdvAspectsTimelineControls
        instanceId="fullscreen"
        {activePreset}
        {focusFilter}
        {aspectFilter}
        {aspectTypes}
        {orbLimit}
        {searchFilter}
        {movementFilter}
        {groupBy}
        {hideVeryFast}
        {loading}
        spanCount={spans.length}
        {hiddenCount}
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
        {aspectFilter}
        {orbLimit}
        {searchFilter}
        {movementFilter}
        {hideVeryFast}
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
    background: linear-gradient(90deg, transparent, #38bdf8, transparent);
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
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: 8px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .action-btn:hover:not(:disabled) {
    color: #e2e8f0;
    border-color: rgba(56, 189, 248, 0.4);
    background: rgba(56, 189, 248, 0.08);
  }
  .action-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .action-btn--expand { margin-left: auto; font-size: 14px; }
  .timeline-peak-rail {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 8px 10px;
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: 8px;
    background: rgba(15, 23, 42, 0.45);
  }
  .rail-label {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
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
    border: 1px solid rgba(56, 189, 248, 0.16);
    background: rgba(8, 47, 73, 0.24);
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
    color: #7dd3fc;
    font-weight: 700;
  }
  .peak-btn:hover {
    border-color: rgba(56, 189, 248, 0.45);
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
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid rgba(148,163,184,0.2);
    background: rgba(15,23,42,0.85);
    color: #94a3b8;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, border-color 0.15s;
  }
  .zoom-btns button:hover:not(:disabled) {
    color: #e2e8f0;
    border-color: #38bdf8;
  }
  .zoom-btns button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .fs-close {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.7);
    color: #94a3b8;
    font-size: 16px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, border-color 0.15s;
  }
  .fs-close:hover { color: #f43f5e; border-color: rgba(244, 63, 94, 0.4); }
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
