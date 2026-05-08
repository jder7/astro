<script>
  import { onMount } from 'svelte';
  import { aspectHexColor, aspectIcon } from '$lib/astro/aspects';
  import { POINT_SYMBOLS, astroFontSignGlyph } from '$lib/astro/signs';
  import { spanSpeedClass, spanSpeedDebug, spanPrimaryPointLabel, packRows, formatDuration, isVeryFastSpanForRange, pointSpeedRank, spanFastestPointRank } from '$lib/astro/timeline/spans';

  export let spans = [];
  export let viewStart = 0;
  export let viewEnd = 0;
  export let groupBy = 'planet';
  export let activePreset = '1M';
  export let focusFilter = 'all';
  export let aspectFilter = 'all';
  export let orbLimit = 3;
  export let searchFilter = '';
  export let movementFilter = 'both';
  export let hideVeryFast = false;
  export let selectedSpan = null;
  export let frozen = false;
  export let onSelectSpan = () => {};
  export let onViewChange = () => {};
  export let onPinMove = () => {};

  let svgEl;
  let containerEl;
  let width = 800;
  let hoveredSpan = null;
  let tooltipX = 0;
  let tooltipY = 0;
  let highlightedGroup = null;
  let rafDomain = null;
  let rafPin = null;
  let pendingDomain = null;
  let pendingPin = null;
  let showPinTooltip = false;
  let pinTooltipTimer = null;

  // Draggable pin state
  export let pinTs = 0;
  let isDraggingPin = false;

  const MARGIN = { top: 36, right: 16, bottom: 8, left: 150 };
  const ROW_H = 26;
  const ROW_GAP = 2;
  const GROUP_PAD = 14;
  const MIN_BAR_W = 3;
  const BAR_RX = 21;
  const normalizeKey = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const domSlug = (v) => normalizeKey(v).replace(/_/g, '-');
  const groupLabel = (v) => String(v || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  const aspectPriorityRank = (value) => {
    const ranks = {
      opposition: 0,
      square: 1,
      conjunction: 2,
      trine: 3,
      sextile: 4,
      quincunx: 5,
      semisquare: 6,
      sesquiquadrate: 7,
      semisextile: 8,
      quintile: 9,
      biquintile: 10,
      septile: 11,
      novile: 12,
    };
    return ranks[normalizeAspect(value)] ?? 99;
  };
  const pointIcon = (label) => POINT_SYMBOLS[normalizeKey(label)] || '';
  const spanSignGlyph = (span, side) => astroFontSignGlyph(side === 'left' ? span?.leftSign : span?.rightSign);
  const matchesMovement = (span, mode) => {
    if (mode === 'both') return true;
    const m = String(span.movementStart || '').toLowerCase();
    return mode === 'applying' ? m.includes('applying') : m.includes('separating');
  };
  const matchesSearch = (span, q) => {
    if (!q) return true;
    const lq = q.toLowerCase();
    return span.left.toLowerCase().includes(lq) || span.right.toLowerCase().includes(lq) || span.aspectType.toLowerCase().includes(lq);
  };
  const normalizeAspect = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  const matchesAspectType = (span, filter) => filter === 'all' || normalizeAspect(span.aspectType) === normalizeAspect(filter);
  const pinStepMs = (preset) => {
    if (preset === '1D') return 15 * 60_000;
    if (preset === '1W') return 60 * 60_000;
    return 86_400_000;
  };
  const snapPinTs = (ts) => {
    const step = pinStepMs(activePreset);
    return Number.isFinite(ts) ? Math.round(ts / step) * step : ts;
  };
  const pinHeadLabel = (ts) => {
    if (!Number.isFinite(ts)) return '';
    const d = new Date(ts);
    if (activePreset === '1D') return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (activePreset === '1W') return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const pinTooltipTimestamp = (ts) =>
    Number.isFinite(ts) ? new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '';

  // --- Filtered spans ---
  $: filtered = spans.filter((s) => {
    if (Number.isFinite(s.minOrb) && s.minOrb > orbLimit) return false;
    if (focusFilter !== 'all' && spanSpeedClass(s) !== focusFilter) return false;
    if (!matchesAspectType(s, aspectFilter)) return false;
    if (hideVeryFast && isVeryFastSpanForRange(s, viewEnd - viewStart)) return false;
    if (!matchesMovement(s, movementFilter)) return false;
    if (!matchesSearch(s, searchFilter)) return false;
    return true;
  });

  $: visibleSpans = filtered.filter((s) => s.endAt >= viewStart && s.startAt <= viewEnd);
  $: denseMode = visibleSpans.length > 400;
  $: if (spans.length) {
    const summaries = spans.map(spanSpeedDebug);
    const bucketCounts = summaries.reduce((acc, item) => {
      acc[item.speedClass] = (acc[item.speedClass] || 0) + 1;
      return acc;
    }, {});
    const passParents = spans
      .filter((span) => span.passes?.length)
      .map((span) => ({
        id: span.id,
        left: span.left,
        aspectType: span.aspectType,
        right: span.right,
        speedClass: spanSpeedClass(span),
        passCount: span.passes.length,
        exacts: span.passes.map((pass) => new Date(pass.exactAt).toISOString().slice(0, 10)),
      }));
    console.debug('[AdvAspectsTimeline][debug]', {
      total: spans.length,
      visible: visibleSpans.length,
      filtered: filtered.length,
      focusFilter,
      groupBy,
      bucketCounts,
      passParents,
      outerSamples: summaries
        .filter((item) => item.slowestRank >= 9)
        .slice(0, 20),
    });
  }

  // --- Time scale ---
  const plotW = () => Math.max(1, width - MARGIN.left - MARGIN.right);
  const scaleTime = (t) => {
    const pw = plotW();
    if (viewEnd <= viewStart || pw <= 0) return MARGIN.left;
    return MARGIN.left + ((t - viewStart) / (viewEnd - viewStart)) * pw;
  };
  const invertScale = (px) => {
    const pw = plotW();
    if (pw <= 0) return viewStart;
    return viewStart + ((px - MARGIN.left) / pw) * (viewEnd - viewStart);
  };

  // --- Grouping & layout ---
  const groupSpans = (items, mode) => {
    const groups = new Map();
    for (const s of items) {
      let gKey;
      if (mode === 'aspectType') gKey = s.aspectType;
      else if (mode === 'planet') gKey = spanPrimaryPointLabel(s);
      else gKey = spanSpeedClass(s);
      if (!groups.has(gKey)) groups.set(gKey, []);
      groups.get(gKey).push(s);
    }
    return groups;
  };

  const groupSortRank = (label, items, mode) => {
    if (mode === 'planet') return pointSpeedRank(label);
    if (mode === 'speed') {
      const ranks = { very_fast: 0, fast: 1, normal: 2, slow: 3, very_slow: 4 };
      return ranks[normalizeKey(label)] ?? 99;
    }
    if (mode === 'aspectType') return aspectPriorityRank(label);
    if (!items.length) return 99;
    return Math.min(...items.map(spanFastestPointRank));
  };

  $: groups = groupSpans(visibleSpans, groupBy);
  $: layout = computeLayout(groups, width, viewStart, viewEnd);

  function computeLayout(grps) {
    const lanes = [];
    let y = MARGIN.top;
    const orderedGroups = Array.from(grps.entries()).sort((a, b) => {
      const rankDiff = groupSortRank(a[0], a[1], groupBy) - groupSortRank(b[0], b[1], groupBy);
      if (rankDiff !== 0) return rankDiff;
      return String(a[0]).localeCompare(String(b[0]));
    });
    for (const [label, groupSpans] of orderedGroups) {
      const sorted = groupSpans.slice().sort((a, b) => a.startAt - b.startAt);
      const { assignment, rowCount } = packRows(sorted, scaleTime);
      const groupH = rowCount * (ROW_H + ROW_GAP);
      lanes.push({
        label: groupLabel(label),
        slug: domSlug(label),
        y,
        height: groupH,
        spans: sorted.map((s) => ({ ...s, row: assignment.get(s.id) || 0 })),
      });
      y += groupH + GROUP_PAD;
    }
    return { lanes, totalHeight: Math.max(y + MARGIN.bottom, 120) };
  }

  // --- Time axis ticks (proportional to viewport width) ---
  $: ticks = computeTicks(viewStart, viewEnd, width);

  function computeTicks(start, end, w) {
    if (!start || !end || end <= start) return [];
    const range = end - start;
    const maxTicks = Math.max(3, Math.floor((w - MARGIN.left - MARGIN.right) / 90));
    const result = [];
    let step, fmt;
    if (range <= 2 * 86_400_000) {
      step = Math.max(3_600_000, range / maxTicks);
      fmt = (d) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } else if (range <= 14 * 86_400_000) {
      step = Math.max(86_400_000, range / maxTicks);
      fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else if (range <= 90 * 86_400_000) {
      step = Math.max(7 * 86_400_000, range / maxTicks);
      fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else {
      step = Math.max(30 * 86_400_000, range / maxTicks);
      fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    }
    let t = Math.ceil(start / step) * step;
    while (t <= end && result.length < maxTicks + 2) {
      result.push({ x: scaleTime(t), label: fmt(new Date(t)), ts: t });
      t += step;
    }
    return result;
  }

  // --- "Now" needle ---
  $: nowMs = Date.now();
  $: nowX = scaleTime(nowMs);
  $: nowVisible = nowMs >= viewStart && nowMs <= viewEnd;

  // --- Pin ---
  $: snappedPinTs = snapPinTs(pinTs);
  $: pinX = scaleTime(snappedPinTs);
  $: pinVisible = snappedPinTs >= viewStart && snappedPinTs <= viewEnd;
  $: pinActiveSpans = snappedPinTs
    ? visibleSpans
        .filter((s) => s.startAt <= snappedPinTs && s.endAt >= snappedPinTs)
        .sort((a, b) => (a.endAt - a.startAt) - (b.endAt - b.startAt))
    : [];
  $: if (!pinActiveSpans.length) showPinTooltip = false;

  const revealPinTooltip = () => {
    showPinTooltip = true;
    if (pinTooltipTimer) clearTimeout(pinTooltipTimer);
    pinTooltipTimer = setTimeout(() => {
      showPinTooltip = false;
      pinTooltipTimer = null;
    }, 2000);
  };

  // --- Zoom (Ctrl+wheel only) / Pan (drag) ---
  let isPanning = false;
  let panStartX = 0;
  let panStartDomain = [0, 0];

  const scheduleViewChange = (start, end) => {
    pendingDomain = [start, end];
    if (rafDomain) return;
    rafDomain = requestAnimationFrame(() => {
      rafDomain = null;
      const next = pendingDomain;
      pendingDomain = null;
      if (next) onViewChange(next[0], next[1]);
    });
  };

  const schedulePinMove = (ts) => {
    pendingPin = ts;
    if (rafPin) return;
    rafPin = requestAnimationFrame(() => {
      rafPin = null;
      const next = pendingPin;
      pendingPin = null;
      if (Number.isFinite(next)) onPinMove(next);
    });
  };

  const handleWheel = (e) => {
    if (frozen) return;
    if (!e.ctrlKey && !e.metaKey) return; // plain scroll passes through
    e.preventDefault();
    const rect = svgEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const frac = (mx - MARGIN.left) / plotW();
    const center = viewStart + frac * (viewEnd - viewStart);
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    let newStart = center - (center - viewStart) * factor;
    let newEnd = center + (viewEnd - center) * factor;
    if (newEnd - newStart < 7_200_000) return;
    onViewChange(newStart, newEnd);
  };

  const handlePointerDown = (e) => {
    if (frozen) return;
    if (e.button !== 0) return;
    // Check if clicking near pin
    if (pinVisible && Math.abs(e.clientX - svgEl.getBoundingClientRect().left - pinX) < 8) {
      isDraggingPin = true;
      revealPinTooltip();
      svgEl.setPointerCapture(e.pointerId);
      return;
    }
    isPanning = true;
    panStartX = e.clientX;
    panStartDomain = [viewStart, viewEnd];
    svgEl.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (frozen) return;
    if (isDraggingPin) {
      const rect = svgEl.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const ts = snapPinTs(invertScale(px));
      pinTs = Math.max(viewStart, Math.min(viewEnd, ts));
      schedulePinMove(pinTs);
      revealPinTooltip();
      return;
    }
    if (!isPanning) return;
    const dx = e.clientX - panStartX;
    const pxPerMs = plotW() / (panStartDomain[1] - panStartDomain[0]);
    const shift = -dx / pxPerMs;
    scheduleViewChange(panStartDomain[0] + shift, panStartDomain[1] + shift);
  };

  const handlePointerUp = () => { isPanning = false; isDraggingPin = false; };

  // Click on x-axis area moves pin
  const handleAxisClick = (e) => {
    if (frozen) return;
    const rect = svgEl.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (px < MARGIN.left || px > width - MARGIN.right) return;
    const y = e.clientY - rect.top;
    if (y > MARGIN.top) return; // only axis area
    pinTs = Math.max(viewStart, Math.min(viewEnd, snapPinTs(invertScale(px))));
    onPinMove(pinTs);
    revealPinTooltip();
  };

  // Click on y-axis (lane label) highlights group
  const handleLabelClick = (label) => {
    highlightedGroup = highlightedGroup === label ? null : label;
  };

  // --- Hover ---
  const handleBarEnter = (span, e) => {
    hoveredSpan = span;
    const rect = containerEl.getBoundingClientRect();
    tooltipX = e.clientX - rect.left;
    tooltipY = e.clientY - rect.top - 10;
  };
  const handleBarLeave = () => { hoveredSpan = null; };
  const handleBarClick = (span) => { if (!frozen) onSelectSpan(span); };
  const handleKeyDown = (e) => { if (e.key === 'Escape') { onSelectSpan(null); highlightedGroup = null; } };

  // --- Zoom buttons ---
  const zoomIn = () => {
    if (frozen) return;
    const center = (viewStart + viewEnd) / 2;
    const half = (viewEnd - viewStart) / 2 * 0.7;
    if (half * 2 < 7_200_000) return;
    onViewChange(center - half, center + half);
  };
  const zoomOut = () => {
    if (frozen) return;
    const center = (viewStart + viewEnd) / 2;
    const half = (viewEnd - viewStart) / 2 * 1.4;
    onViewChange(center - half, center + half);
  };

  // --- Resize observer ---
  onMount(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) width = entry.contentRect.width || 800;
    });
    ro.observe(containerEl);
    return () => {
      ro.disconnect();
      if (rafDomain) cancelAnimationFrame(rafDomain);
      if (rafPin) cancelAnimationFrame(rafPin);
      if (pinTooltipTimer) clearTimeout(pinTooltipTimer);
    };
  });

  // --- Bar helpers ---
  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const visibleStartAt = (s) => Math.max(s.startAt, viewStart);
  const visibleEndAt = (s) => Math.min(s.endAt, viewEnd);
  const visibleDuration = (s) => visibleEndAt(s) - visibleStartAt(s);
  const barX = (s) => Math.max(MARGIN.left, Math.min(width - MARGIN.right, scaleTime(visibleStartAt(s))));
  const barW = (s) => {
    const left = barX(s);
    const right = Math.max(MARGIN.left, Math.min(width - MARGIN.right, scaleTime(visibleEndAt(s))));
    return Math.max(MIN_BAR_W, right - left);
  };
  const barY = (s, laneY) => laneY + s.row * (ROW_H + ROW_GAP);
  const barColor = (s) => aspectHexColor(s.aspectType);
  const laneBandFill = (lane, index) => {
    if (groupBy === 'aspectType') return aspectHexColor(lane.label);
    return index % 2 === 0 ? '#e2e8f0' : '#38bdf8';
  };
  const exactX = (s) => scaleTime(s.exactAt);
  const fmtOrb = (v) => Number.isFinite(v) ? `${v.toFixed(2)}°` : '';

  // Gradient ID per span
  const gradId = (s) => `sg-${s.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

  // Applying/separating gradient stops:
  // applying: green→gold (gold at 95%), exact marker, separating: gold→red (gold at 5%)
  const gradStops = (s) => {
    const start = visibleStartAt(s);
    const end = visibleEndAt(s);
    const total = end - start;
    if (total <= 0) return { applyEnd: 0.5, sepStart: 0.5 };
    const exactFrac = clamp01((s.exactAt - start) / total);
    const goldBand = 0.018;
    return {
      applyEnd: clamp01(exactFrac - goldBand / 2),
      sepStart: clamp01(exactFrac + goldBand / 2),
      exactFrac,
    };
  };

  const barOpacity = () => 0.5;

  const isGroupDimmed = (laneLabel) => highlightedGroup && highlightedGroup !== laneLabel;
  const barFill = (span) => `url(#${gradId(span)})`;
  const spanDomId = (span) => `timeline-span-${domSlug(span.id)}`;
  const passDomId = (span, pass) => `timeline-pass-${domSlug(pass.id || `${span.id}-${pass.seriesIndex}`)}`;
  const laneDomId = (lane) => `timeline-lane-${lane.slug}`;
  const gradientDomId = (span) => `timeline-gradient-${domSlug(span.id)}`;
  const passX = (pass) => Math.max(MARGIN.left, Math.min(width - MARGIN.right, scaleTime(Math.max(pass.startAt, viewStart))));
  const passW = (pass) => {
    const left = passX(pass);
    const right = Math.max(MARGIN.left, Math.min(width - MARGIN.right, scaleTime(Math.min(pass.endAt, viewEnd))));
    return Math.max(MIN_BAR_W, right - left);
  };
  const asSelectablePass = (span, pass) => ({
    ...span,
    ...pass,
    id: pass.id,
    parentId: span.id,
    left: span.left,
    right: span.right,
    aspectType: span.aspectType,
    leftOwner: span.leftOwner,
    rightOwner: span.rightOwner,
    mode: span.mode,
    passes: span.passes || [],
    engine: span.engine,
    isAspectPass: true,
  });
</script>

<div
  class="timeline-container"
  id="advanced-aspects-timeline-viewport"
  class:timeline-container--frozen={frozen}
  bind:this={containerEl}
  tabindex="-1"
  role="application"
  aria-label="Aspects timeline"
  aria-busy={frozen}
>
  <!-- Zoom buttons -->
  <div class="zoom-btns">
    <button type="button" class="timeline-zoom-button timeline-zoom-button--in" id="timeline-zoom-in" on:click={zoomIn} title="Zoom in (or Ctrl+scroll)" disabled={!spans.length || frozen}>+</button>
    <button type="button" class="timeline-zoom-button timeline-zoom-button--out" id="timeline-zoom-out" on:click={zoomOut} title="Zoom out (or Ctrl+scroll)" disabled={!spans.length || frozen}>−</button>
  </div>

  <svg
    bind:this={svgEl}
    width={width}
    height={layout.totalHeight}
    class="timeline-svg"
    id="advanced-aspects-timeline-svg"
    on:wheel={handleWheel}
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerUp}
    on:pointercancel={handlePointerUp}
    on:click={handleAxisClick}
    on:keydown={handleKeyDown}
    role="button"
    aria-label="Timeline interaction surface"
    tabindex="0"
  >
    <defs id="advanced-aspects-timeline-gradients" class="timeline-gradient-definitions">
      {#each visibleSpans as span}
        {@const g = gradStops(span)}
        <linearGradient id={gradId(span)} class="timeline-span-gradient" data-gradient-id={gradientDomId(span)} data-span-id={span.id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#22c55e" stop-opacity="0.8" />
          <stop offset="{g.applyEnd * 100}%" stop-color="#eab308" stop-opacity="1" />
          <stop offset="{g.sepStart * 100}%" stop-color="#eab308" stop-opacity="1" />
          <stop offset="100%" stop-color="#ef4444" stop-opacity="0.8" />
        </linearGradient>
      {/each}
    </defs>

    <!-- Time axis -->
    <g id="advanced-aspects-timeline-axis" class="timeline-axis-layer">
      {#each ticks as tick}
        <line class="timeline-axis-gridline" x1={tick.x} y1={MARGIN.top - 4} x2={tick.x} y2={layout.totalHeight - MARGIN.bottom} stroke="rgba(148,163,184,0.08)" stroke-width="1" />
        <text class="timeline-axis-tick-label" x={tick.x} y={MARGIN.top - 10} fill="#64748b" font-size="10" text-anchor="middle" font-weight="600">{tick.label}</text>
      {/each}
    </g>

    <!-- "Now" needle -->
    {#if nowVisible}
      <line id="advanced-aspects-timeline-now-needle" class="timeline-now-needle" x1={nowX} y1={MARGIN.top - 4} x2={nowX} y2={layout.totalHeight - MARGIN.bottom} stroke="#64748b" stroke-width="1" stroke-dasharray="4,3" opacity="0.5" />
    {/if}

    <!-- Lanes -->
    <g id="advanced-aspects-timeline-lanes" class="timeline-lanes-layer">
    {#each layout.lanes as lane, laneIndex}
      <g id={laneDomId(lane)} class="timeline-lane-group" data-lane-label={lane.label} data-lane-slug={lane.slug}>
      <rect
        class="timeline-lane-band"
        x={0}
        y={Math.max(MARGIN.top - GROUP_PAD / 2, lane.y - GROUP_PAD / 2)}
        width={width}
        height={lane.height + GROUP_PAD}
        fill={laneBandFill(lane, laneIndex)}
        fill-opacity={highlightedGroup === lane.label ? 0.08 : 0.035}
        pointer-events="none"
      />
      <!-- Group label (clickable) -->
      <text
        x={8} y={lane.y + 14}
        fill={highlightedGroup === lane.label ? '#7dd3fc' : '#94a3b8'}
        font-size="11" font-weight="700"
        class="lane-label timeline-lane-label"
        style="cursor:pointer"
        on:click={() => handleLabelClick(lane.label)}
        role="button"
        tabindex="0"
        on:keydown={(e) => { if (e.key === 'Enter') handleLabelClick(lane.label); }}
      >{lane.label}</text>
      <line class="timeline-lane-divider" x1={MARGIN.left} y1={lane.y} x2={width - MARGIN.right} y2={lane.y} stroke="rgba(148,163,184,0.06)" stroke-width="1" />

      <!-- Span bars with applying/separating gradient -->
      <g class="timeline-span-bars" data-lane-label={lane.label}>
      {#each lane.spans as span}
        {@const bx = barX(span)}
        {@const bw = barW(span)}
        {@const by = barY(span, lane.y)}
        {@const op = barOpacity(span)}
        {@const ex = exactX(span)}
        {@const isSelected = selectedSpan?.id === span.id}
        {@const dimmed = isGroupDimmed(lane.label)}

        <rect
          id={spanDomId(span)}
          data-span-id={span.id}
          data-aspect-type={span.aspectType}
          data-left-point={span.left}
          data-right-point={span.right}
          data-left-owner={span.leftOwner}
          data-right-owner={span.rightOwner}
          data-speed-class={spanSpeedClass(span)}
          x={bx} y={by + 2} width={bw} height={ROW_H - 4} rx={BAR_RX}
          fill={barFill(span)}
          fill-opacity={dimmed ? 0.15 : op}
          stroke={barColor(span)}
          stroke-opacity={isSelected ? 1 : 0.8}
          stroke-width={isSelected ? 1.5 : 0.8}
          stroke-dasharray={span.confidence !== 'full' ? '3,2' : 'none'}
          class="span-bar timeline-span-bar"
          class:timeline-span-bar--selected={isSelected}
          class:timeline-span-bar--dimmed={dimmed}
          role="button" tabindex="0"
          aria-label="{span.left} {span.aspectType} {span.right}, orb {fmtOrb(span.minOrb)}"
          on:mouseenter={(e) => handleBarEnter(span, e)}
          on:mouseleave={handleBarLeave}
          on:pointerdown={(e) => e.stopPropagation()}
          on:click={() => handleBarClick(span)}
          on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBarClick(span); }}
        />

        <!-- Exact marker -->
        {#if ex >= MARGIN.left && ex <= width - MARGIN.right && !dimmed}
          <text class="timeline-exact-marker" data-span-id={span.id} x={ex} y={by + ROW_H / 2 + 2} fill="#fbbf24" font-size="7" text-anchor="middle" pointer-events="none">✧</text>
        {/if}

        <!-- Inline label -->
        {#if bw > 60 && !dimmed && !denseMode}
          <text class="timeline-span-inline-label" data-span-id={span.id} x={bx + 9} y={by + ROW_H / 2 + 3} fill="#fff" fill-opacity="0.85" font-size="9" font-weight="600" pointer-events="none">
            {pointIcon(span.left)} {aspectIcon(span.aspectType)} {pointIcon(span.right)}
          </text>
        {/if}

        {#if span.passes?.length && span.passes?.length > 1 && !dimmed}
          <g class="timeline-pass-segments" data-parent-span-id={span.id}>
            {#each span.passes as pass}
              {@const px = passX(pass)}
              {@const pw = passW(pass)}
              {@const passSelected = selectedSpan?.id === pass.id}
              <rect
                id={passDomId(span, pass)}
                class="timeline-pass-segment"
                class:timeline-pass-segment--selected={passSelected}
                data-parent-span-id={span.id}
                data-pass-id={pass.id}
                data-pass-index={pass.seriesIndex}
                x={px}
                y={by + 2 * ROW_H / 3}
                width={pw}
                height={(ROW_H - 4) / 3}
                rx="3"
                fill={barColor(span)}
                fill-opacity={passSelected ? 0.7 : 0.1}
                stroke={passSelected ? '#fff' : 'rgba(15,23,42,0.65)'}
                stroke-width={passSelected ? 0.5 : 0.1}
                role="button"
                tabindex="0"
                aria-label="{span.left} {span.aspectType} {span.right} pass {pass.seriesIndex} of {pass.seriesCount}"
                on:pointerdown={(e) => e.stopPropagation()}
                on:mouseenter={(e) => handleBarEnter(asSelectablePass(span, pass), e)}
                on:mouseleave={handleBarLeave}
                on:click={() => handleBarClick(asSelectablePass(span, pass))}
                on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBarClick(asSelectablePass(span, pass)); }}
              />
            {/each}
          </g>
        {/if}
      {/each}
      </g>
      </g>
    {/each}
    </g>

    <!-- Empty state -->
    {#if !visibleSpans.length}
      <text id="advanced-aspects-timeline-empty-state" class="timeline-empty-state" x={width / 2} y={MARGIN.top + 40} fill="#64748b" font-size="13" text-anchor="middle">
        {spans.length ? 'All spans filtered out' : 'No data — select a range preset above'}
      </text>
    {/if}

    <!-- Pin and tooltip are drawn last so they stay above lane content. -->
    {#if pinVisible}
      <g id="advanced-aspects-timeline-pin" class="timeline-pin-layer">
        <line x1={pinX} y1={MARGIN.top - 4} x2={pinX} y2={layout.totalHeight - MARGIN.bottom} stroke="#f43f5e" stroke-width="0.5" class="pin-line timeline-pin-line" />
        <rect x={pinX - 24} y={MARGIN.top - 24} width="48" height="18" rx="9" fill="#f43f5e" class="pin-head timeline-pin-head" />
        <text class="timeline-pin-count" x={pinX} y={MARGIN.top - 12} fill="#fff" font-size="9" font-weight="700" text-anchor="middle" pointer-events="none">
          {pinHeadLabel(snappedPinTs)}
        </text>
      </g>
      {#if showPinTooltip && pinActiveSpans.length > 0}
        <foreignObject x={pinX + 12} y={MARGIN.top - 10} width="260" height={Math.min(pinActiveSpans.length * 22 + 30, 160)}>
          <div class="pin-tooltip timeline-pin-tooltip" id="advanced-aspects-timeline-pin-tooltip" xmlns="http://www.w3.org/1999/xhtml">
            <div class="pin-tooltip-time">{pinTooltipTimestamp(snappedPinTs)}</div>
            {#each pinActiveSpans.slice(0, 5) as s}
              <div class="pin-tooltip-row">
                <span class="pin-tooltip-entry">
                  <span style="color:{barColor(s)}">{aspectIcon(s.aspectType)}</span>
                  <span>
                    {pointIcon(s.left)} {s.left}{#if spanSignGlyph(s, 'left')} <span class="timeline-tooltip-zodiac-icon">{spanSignGlyph(s, 'left')}</span>{/if}
                    –
                    {pointIcon(s.right)} {s.right}{#if spanSignGlyph(s, 'right')} <span class="timeline-tooltip-zodiac-icon">{spanSignGlyph(s, 'right')}</span>{/if}
                  </span>
                </span>
                <span class="pin-tooltip-duration">{formatDuration(s.endAt - s.startAt)}</span>
              </div>
            {/each}
            {#if pinActiveSpans.length > 5}
              <div class="pin-tooltip-row" style="color:#64748b">+{pinActiveSpans.length - 5} more</div>
            {/if}
          </div>
        </foreignObject>
      {/if}
    {/if}
  </svg>

  <!-- Hover tooltip -->
  {#if hoveredSpan}
    <div class="timeline-tooltip" id="advanced-aspects-timeline-hover-tooltip" style="left:{tooltipX}px;top:{tooltipY}px">
      <span>{pointIcon(hoveredSpan.left)} {hoveredSpan.left}{#if spanSignGlyph(hoveredSpan, 'left')} <span class="timeline-tooltip-zodiac-icon">{spanSignGlyph(hoveredSpan, 'left')}</span>{/if}</span>
      <span style="color:{barColor(hoveredSpan)}">{aspectIcon(hoveredSpan.aspectType)}</span>
      <span>{pointIcon(hoveredSpan.right)} {hoveredSpan.right}{#if spanSignGlyph(hoveredSpan, 'right')} <span class="timeline-tooltip-zodiac-icon">{spanSignGlyph(hoveredSpan, 'right')}</span>{/if}</span>
      <span class="tt-orb">{fmtOrb(hoveredSpan.minOrb)}</span>
      <span class="tt-dur">{formatDuration(visibleDuration(hoveredSpan))}</span>
    </div>
  {/if}

  {#if frozen}
    <div class="timeline-freeze-overlay" id="advanced-aspects-timeline-freeze-overlay" aria-hidden="true"></div>
  {/if}
</div>

<style>
  .timeline-container {
    position: relative;
    width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    border-radius: 12px;
    background: rgba(10, 16, 28, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.08);
    outline: none;
  }
  .timeline-svg {
    display: block;
    cursor: grab;
    user-select: none;
  }
  .timeline-svg:active { cursor: grabbing; }
  .timeline-container--frozen .timeline-svg {
    cursor: wait;
  }
  .timeline-freeze-overlay {
    position: absolute;
    inset: 0;
    z-index: 8;
    cursor: wait;
    background: rgba(15, 23, 42, 0.12);
  }
  .zoom-btns {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 2px;
    z-index: 5;
  }
  .zoom-btns button {
    width: 26px; height: 26px;
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 18%, #1e293b 82%);
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 24%, rgba(15,23,42,0.85));
    color: color-mix(in srgb, var(--accent, #06b6d4) 18%, #cbd5e1 82%);
    font-size: 16px; font-weight: 700;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .zoom-btns button:hover:not(:disabled) {
    color: #f8fafc;
    border-color: color-mix(in srgb, var(--accent, #06b6d4) 45%, #334155 55%);
    background: var(--accent-soft, rgba(14, 165, 233, 0.12));
  }
  .zoom-btns button:disabled { opacity: 0.3; cursor: not-allowed; }
  .span-bar { cursor: pointer; transition: fill-opacity 0.12s; }
  .span-bar:hover { fill-opacity: 0.9 !important; }
  .span-bar:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 1px; }
  .timeline-pass-segment {
    cursor: pointer;
    transition: fill-opacity 0.12s, stroke 0.12s;
  }
  .timeline-pass-segment:hover {
    fill-opacity: 1;
  }
  .pin-line { cursor: ew-resize; }
  .pin-head { cursor: ew-resize; }
  .pin-tooltip {
    background: rgba(15,23,42,0.95);
    border: 1px solid rgba(148,163,184,0.2);
    border-radius: 8px;
    padding: 4px 8px;
    font-size: 10px;
    color: #e2e8f0;
    line-height: 1.6;
  }
  .pin-tooltip-time {
    color: #cbd5e1;
    font-weight: 700;
    border-bottom: 1px solid rgba(148,163,184,0.12);
    margin-bottom: 3px;
    padding-bottom: 2px;
  }
  .pin-tooltip-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    white-space: nowrap;
  }
  .pin-tooltip-entry {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pin-tooltip-duration {
    flex: 0 0 auto;
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
  }
  .timeline-tooltip-zodiac-icon {
    color: #facc15;
    font-size: 1.05em;
    vertical-align: -0.04em;
  }
  .timeline-tooltip {
    position: absolute;
    padding: 5px 10px;
    border-radius: 8px;
    background: rgba(15,23,42,0.95);
    border: 1px solid rgba(148,163,184,0.2);
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    color: #e2e8f0;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 5px;
    pointer-events: none;
    white-space: nowrap;
    transform: translate(-50%, -100%);
    z-index: 10;
  }
  .tt-orb { font-size: 10px; color: #94a3b8; }
  .tt-dur { font-size: 10px; color: #7dd3fc; border-left: 1px solid rgba(148,163,184,0.2); padding-left: 5px; }
</style>
