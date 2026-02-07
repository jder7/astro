<script>
  import ElementSigil from '$components/shared/ElementSigil.svelte';
  import { toDate } from '$lib/astro/date';
  import { signSymbol, signName, QUALITY_ICON, ELEMENT_ICON, ELEMENT_HEX } from '$lib/astro/signs';

  export let ranges = [];
  export let subjectElements = {};

  const HOUR_MS = 60 * 60 * 1000;
  const VIEWBOX_SIZE = 420;
  const SVG_CENTER = VIEWBOX_SIZE / 2;
  const SIGIL_SIZE = 72;
  const HAND_COLORS = ['#38bdf8', '#34d399'];
  const withAlpha = (hex, alpha = '26') => (hex ? `${hex}${alpha}` : `${ELEMENT_HEX.Default}${alpha}`);

  const clampHour = (n) => Math.max(0, Math.min(24, n));
  const wrapOffset = (value, hours) => {
    let v = value % hours;
    if (v < 0) v += hours;
    return v;
  };
  const safeDate = (value) => {
    const d = toDate(value);
    return d && !Number.isNaN(d.getTime()) ? d : null;
  };
  const formatTime = (d) => {
    if (!(d instanceof Date)) return '--:--';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const normalizeRange = (range) => {
    const anchor = safeDate(range?.anchor) || safeDate(range?.entries?.[0]?.start) || new Date();
    const entries =
      (range?.entries || [])
        .map((entry) => {
          const start = safeDate(entry.start || entry.timestamp);
          const end = safeDate(entry.end);
          if (!start || !end || end <= start) return null;
          return { ...entry, start, end };
        })
        .filter(Boolean) || [];
    return {
      label: range?.label || range?.id || 'Ascendant',
      anchor,
      entries,
    };
  };

  const splitDecans = (range, windowHours) => {
    const startWindow = range.anchor;
    const endWindow = new Date(startWindow.getTime() + windowHours * HOUR_MS);
    const spanMs = endWindow.getTime() - startWindow.getTime();
    return range.entries.flatMap((entry) => {
      const dur = entry.end.getTime() - entry.start.getTime();
      const segments = [0, 1, 2]
        .map((dec) => {
          const decStart = new Date(entry.start.getTime() + (dur / 3) * dec);
          const decEnd = new Date(entry.start.getTime() + (dur / 3) * (dec + 1));
          const clampStart = Math.max(decStart.getTime(), startWindow.getTime());
          const clampEnd = Math.min(decEnd.getTime(), endWindow.getTime());
          if (clampEnd <= clampStart) return null;
          const startFrac = (clampStart - startWindow.getTime()) / spanMs;
          const endFrac = (clampEnd - startWindow.getTime()) / spanMs;
          const startAngle = -Math.PI / 2 + startFrac * Math.PI * 2;
          const endAngle = -Math.PI / 2 + endFrac * Math.PI * 2;
          const midAngle = (startAngle + endAngle) / 2;
          const element = entry.element || 'Default';
          return {
            entry,
            dec,
            element,
            quality: entry.quality,
            sign: entry.sign,
            startAngle,
            endAngle,
            midAngle,
            startTime: decStart,
            endTime: decEnd,
          };
        })
        .filter(Boolean);
      const firstVisible = segments[0] || null;
      return segments.map((seg) => ({ ...seg, showSign: seg.dec === 0 || seg === firstVisible }));
    });
  };

  const ringConfig = (idx) => (idx === 0 ? { outer: 170, inner: 120, hand: 165 } : { outer: 110, inner: 70, hand: 105 });

  let windowHours = 12;
  let offsets = [];
  let highlight = { rangeIdx: -1, sign: null };

  $: normalized = (ranges || []).map(normalizeRange).filter((r) => r.entries.length);
  $: if (normalized.length !== offsets.length) {
    offsets = normalized.map(() => 0);
  }
  $: decanSegments = normalized.map((r) => splitDecans(r, windowHours));
  $: activeSlices = normalized.map((r, i) => {
    const off = wrapOffset(offsets[i] || 0, windowHours);
    const start = new Date(r.anchor.getTime() + off * HOUR_MS);
    const end = new Date(start.getTime() + HOUR_MS);
    const span = windowHours * HOUR_MS;
    const startFrac = (start.getTime() - r.anchor.getTime()) / span;
    const endFrac = (end.getTime() - r.anchor.getTime()) / span;
    return {
      start,
      end,
      startAngle: -Math.PI / 2 + startFrac * Math.PI * 2,
      endAngle: -Math.PI / 2 + endFrac * Math.PI * 2,
    };
  });
  $: summaries = activeSlices.map((_, i) => summaryFor(i));
  $: selectedRangeIdx = highlight.rangeIdx >= 0 && highlight.rangeIdx < normalized.length ? highlight.rangeIdx : normalized.length ? 0 : -1;
  $: selectedSummary = selectedRangeIdx !== -1 ? summaries[selectedRangeIdx] : null;
  $: baseSigil = subjectElements || {};
  $: sigilPayload = {
    sunElement: baseSigil.sunElement || '',
    moonElement: baseSigil.moonElement || '',
    dayElement: baseSigil.dayElement || '',
    dayRulerKey: baseSigil.dayRulerKey || '',
    ascElement: (selectedSummary && selectedSummary.element) || baseSigil.ascElement || '',
    sunSign: baseSigil.sunSign || '',
    moonSign: baseSigil.moonSign || '',
    daySign: baseSigil.daySign || '',
    ascSign: selectedSummary?.sign || baseSigil.ascSign || '',
  };
  $: hasSigilPayload = Boolean(
    sigilPayload.sunElement || sigilPayload.moonElement || sigilPayload.dayElement || sigilPayload.ascElement
  );
  $: sigilTargetSlice = selectedRangeIdx !== -1 ? activeSlices[selectedRangeIdx] : null;
  $: sigilRing = selectedRangeIdx !== -1 ? ringConfig(selectedRangeIdx) : null;
  $: sigilPosition =
    sigilTargetSlice && sigilRing
      ? (() => {
          const midAngle = (sigilTargetSlice.startAngle + sigilTargetSlice.endAngle) / 2;
          const radius = (sigilRing.outer + sigilRing.inner) / 2;
          return {
            x: SVG_CENTER + radius * Math.cos(midAngle),
            y: SVG_CENTER + radius * Math.sin(midAngle),
          };
        })()
      : null;
  $: sigilPositionPercent = sigilPosition
    ? {
        left: (sigilPosition.x / VIEWBOX_SIZE) * 100,
        top: (sigilPosition.y / VIEWBOX_SIZE) * 100,
      }
    : null;

  const arcPath = (cx, cy, r, start, end) => {
    const large = end - start > Math.PI ? 1 : 0;
    const sx = cx + r * Math.cos(start);
    const sy = cy + r * Math.sin(start);
    const ex = cx + r * Math.cos(end);
    const ey = cy + r * Math.sin(end);
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
  };

  const contourPath = (outer, inner, start, end) => {
    const large = end - start > Math.PI ? 1 : 0;
    const sx = 210 + outer * Math.cos(start);
    const sy = 210 + outer * Math.sin(start);
    const ox = 210 + outer * Math.cos(end);
    const oy = 210 + outer * Math.sin(end);
    const ix = 210 + inner * Math.cos(end);
    const iy = 210 + inner * Math.sin(end);
    const isx = 210 + inner * Math.cos(start);
    const isy = 210 + inner * Math.sin(start);
    return [
      `M ${sx} ${sy}`,
      `A ${outer} ${outer} 0 ${large} 1 ${ox} ${oy}`,
      `L ${ix} ${iy}`,
      `A ${inner} ${inner} 0 ${large} 0 ${isx} ${isy}`,
      'Z',
    ].join(' ');
  };

  const clickSegment = (rangeIdx, seg) => {
    const r = normalized[rangeIdx];
    if (!r) return;
    const diffHours = (seg.startTime.getTime() - r.anchor.getTime()) / HOUR_MS;
    const offsetHours = wrapOffset(Math.round(diffHours), windowHours);
    const next = [...offsets];
    next[rangeIdx] = offsetHours;
    offsets = next;
    highlight = { rangeIdx, sign: seg.sign };
  };

  const summaryFor = (rangeIdx) => {
    const r = normalized[rangeIdx];
    const slice = activeSlices[rangeIdx];
    if (!r || !slice) return null;
    const seg =
      decanSegments[rangeIdx]?.find((d) => slice.start >= d.startTime && slice.start < d.endTime) ||
      decanSegments[rangeIdx]?.[0];
    if (!seg) return null;
    const dur = seg.endTime.getTime() - seg.startTime.getTime() || 1;
    const into = Math.min(30, Math.max(0, ((slice.start.getTime() - seg.startTime.getTime()) / dur) * 30));
    const decLabel = `${seg.dec + 1} Dec`;
    return {
      sign: seg.sign,
      element: seg.element,
      quality: seg.quality,
      decLabel,
      orb: `${into.toFixed(1)}°`,
      time: formatTime(slice.start),
    };
  };
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <div>
      <p class="text-xs uppercase tracking-[0.2em] text-cyan-200/80 font-semibold">Ascendant clock</p>
      <p class="text-sm text-slate-300">
        {#if normalized[0]}
          {formatTime(normalized[0].anchor)} (anchor)
        {:else}
          Requested datetime
        {/if}
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button class="button-ghost" type="button" aria-pressed={windowHours === 12} on:click={() => (windowHours = 12)}>Next 12h</button>
      <button class="button-ghost" type="button" aria-pressed={windowHours === 24} on:click={() => (windowHours = 24)}>Next 24h</button>
    </div>
  </div>

  {#if normalized.length}
    <div class="relative w-full max-w-[640px] mx-auto bg-slate-900/70 border border-slate-800 rounded-2xl p-3">
      {#if selectedSummary}
        <div class="absolute top-3 left-3 flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-slate-50 shadow-sm"
            style={`background:${(ELEMENT_HEX[selectedSummary.element] || ELEMENT_HEX.Default)}22; border:1px solid ${(ELEMENT_HEX[selectedSummary.element] || ELEMENT_HEX.Default)}55;`}
          >
            <span aria-hidden="true">{ELEMENT_ICON[selectedSummary.element] || ELEMENT_ICON.Default}</span>
            <span>{selectedSummary.element || '—'}</span>
          </span>
        </div>
        <div class="absolute top-3 right-3 flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-slate-50 shadow-sm"
            style={`background:${withAlpha(ELEMENT_HEX[selectedSummary.element] || ELEMENT_HEX.Default, '26')}; border:1px solid ${(ELEMENT_HEX[selectedSummary.element] || ELEMENT_HEX.Default)}55;`}
          >
            <span aria-hidden="true">{QUALITY_ICON[selectedSummary.quality] || ''}</span>
            <span>{selectedSummary.quality || '—'}</span>
          </span>
        </div>
      {/if}
      <div class="relative">
        <svg viewBox="0 0 420 420" class="w-full h-auto" id="asc-clock-svg">
          {#each normalized as range, discIdx}
            {#if range}
              {#each decanSegments[discIdx] as decanSeg, decanSegIdx}
                {#if decanSeg}
                  <path
                    id={`asc-segment-${discIdx}-${decanSegIdx}`}
                    d={contourPath(ringConfig(discIdx).outer, ringConfig(discIdx).inner, decanSeg.startAngle, decanSeg.endAngle)}
                    stroke={`${(ELEMENT_HEX[decanSeg.element] || ELEMENT_HEX.Default)}55`}
                    stroke-width="0.8"
                    fill={`${(ELEMENT_HEX[decanSeg.element] || ELEMENT_HEX.Default)}12`}
                    opacity="0.5"
                    on:click={() => clickSegment(discIdx, decanSeg)}
                    on:keydown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        clickSegment(discIdx, decanSeg);
                      }
                    }}
                    style="cursor:pointer"
                    role="button"
                    tabindex="0"
                    aria-label={`Select ${decanSeg.sign || 'segment'}`}
                  />
                  <path
                    id={`asc-segment-contour-${discIdx}-${decanSegIdx}`}
                    d={contourPath(ringConfig(discIdx).outer, ringConfig(discIdx).inner, decanSeg.startAngle, decanSeg.endAngle)}
                    stroke={ELEMENT_HEX[decanSeg.element] || ELEMENT_HEX.Default}
                    stroke-width="0.8"
                    fill="none"
                    opacity="0.5"
                    pointer-events="none"
                  />
                  
                  {#if decanSegIdx === 0 || decanSeg.dec === 0}
                    <line
                      id={`asc-segment-start-${discIdx}-${decanSegIdx}`}
                      x1={210 + (ringConfig(discIdx).outer + 6) * Math.cos(decanSeg.startAngle)}
                      y1={210 + (ringConfig(discIdx).outer + 6) * Math.sin(decanSeg.startAngle)}
                      x2={210 + (ringConfig(discIdx).inner - 6) * Math.cos(decanSeg.startAngle)}
                      y2={210 + (ringConfig(discIdx).inner - 6) * Math.sin(decanSeg.startAngle)}
                      stroke={ELEMENT_HEX[decanSeg.element] || ELEMENT_HEX.Default}
                      stroke-width="0.9"
                      stroke-dasharray="1 3"
                    />
                  {/if}
                {#if decanSeg.showSign}
                  <text
                    id={`asc-sign-${discIdx}-${decanSegIdx}`}
                    x={210 + (ringConfig(discIdx).outer + ringConfig(discIdx).inner) / 2 * Math.cos((decanSeg.startAngle * 2 + decanSeg.midAngle) / 3)}
                    y={210 + (ringConfig(discIdx).outer + ringConfig(discIdx).inner) / 2 * Math.sin((decanSeg.startAngle * 2 + decanSeg.midAngle) / 3)}
                    text-anchor="middle"
                      dominant-baseline="central"
                      font-size={discIdx === 0 ? "12" : "10"}
                      fill={ELEMENT_HEX[decanSeg.element] || ELEMENT_HEX.Default}
                      font-weight="700"
                    >
                      {signSymbol(decanSeg.sign) || decanSeg.sign}
                    </text>
                  {/if}
                  {#if discIdx === 0}
                    <text
                      id={`asc-time-start-${discIdx}-${decanSegIdx}`}
                      x={210 + (ringConfig(discIdx).outer + 24) * Math.cos(decanSeg.startAngle)}
                      y={(decanSegIdx === 0 ? 220 : 210) + (ringConfig(discIdx).outer + 24) * Math.sin(decanSeg.startAngle)}
                      text-anchor="middle"
                      dominant-baseline="central"
                      font-size="7"
                      fill="rgba(226,232,240,0.78)"
                    >
                      {formatTime(decanSeg.startTime)}
                    </text>
                  {:else}
                    <text
                      id={`asc-time-start-${discIdx}-${decanSegIdx}`}
                      x={210 + (ringConfig(discIdx).inner - 12) * Math.cos(decanSeg.startAngle)}
                      y={(decanSegIdx === 0 ? 215 : 210) + (ringConfig(discIdx).inner - 12) * Math.sin(decanSeg.startAngle)}
                      text-anchor="middle"
                      dominant-baseline="central"
                      font-size="5"
                      fill="rgba(226,232,240,0.72)"
                    >
                      {formatTime(decanSeg.startTime)}
                    </text>
                  {/if}
                {/if}
              {/each}

              {#if activeSlices[discIdx]}
                <path
                  id={`asc-hand-${discIdx}`}
                  d={arcPath(210, 210, ringConfig(discIdx).hand, activeSlices[discIdx].startAngle, activeSlices[discIdx].endAngle)}
                  stroke={HAND_COLORS[discIdx] || HAND_COLORS[0]}
                  stroke-width="8"
                  fill="none"
                  stroke-linecap="round"
                />
                <line
                  id={`asc-hand-tick-${discIdx}`}
                  x1="210"
                  y1="210"
                  x2={210 + ringConfig(discIdx).hand * Math.cos(activeSlices[discIdx].startAngle)}
                  y2={210 + ringConfig(discIdx).hand * Math.sin(activeSlices[discIdx].startAngle)}
                  stroke={HAND_COLORS[discIdx] || HAND_COLORS[0]}
                  stroke-width="2"
                />
                <circle
                  id={`asc-hand-dot-${discIdx}`}
                  cx={210 + ringConfig(discIdx).hand * Math.cos(activeSlices[discIdx].startAngle)}
                  cy={210 + ringConfig(discIdx).hand * Math.sin(activeSlices[discIdx].startAngle)}
                  r="4"
                  fill={HAND_COLORS[discIdx] || HAND_COLORS[0]}
                />
              {/if}
            {/if}
          {/each}

          {#if normalized.length === 1 && summaries[0]}
            <g transform="translate(210 210)" id="asc-summary-single">
              <rect
                id="asc-summary-box"
                x="-82"
                y="-28"
                width="164"
                height="56"
                rx="10"
                fill={withAlpha(ELEMENT_HEX[summaries[0].element] || ELEMENT_HEX.Default)}
                stroke={ELEMENT_HEX[summaries[0].element] || ELEMENT_HEX.Default}
              />
              <g font-size="10" fill={ELEMENT_HEX[summaries[0].element] || ELEMENT_HEX.Default}>
                <text id="asc-summary-sign" x="-56" y="-2" text-anchor="middle" font-size="16">
                  {signSymbol(summaries[0].sign) || summaries[0].sign}
                </text>
                <text id="asc-summary-name" x="4" y="0" text-anchor="middle" font-size="10">
                  {signName(summaries[0].sign)} · {summaries[0].time}
                </text>
                <text id="asc-summary-meta" x="4" y="14" text-anchor="middle" font-size="9" fill="#cbd5e1">
                  {summaries[0].decLabel} · {summaries[0].orb} · {(QUALITY_ICON[summaries[0].quality] || '') + (summaries[0].quality ? ` ${summaries[0].quality}` : '')} · {ELEMENT_ICON[summaries[0].element] || ELEMENT_ICON.Default}
                </text>
              </g>
            </g>
          {:else if normalized.length > 1}
            {#each normalized as _, i}
              {#if summaries[i]}
                <g transform={`translate(${i === 0 ? 80 : 340} 390)`} id={`asc-summary-${i}`}>
                  <rect
                    id={`asc-summary-box-${i}`}
                    x="-78"
                    y="-26"
                    width="156"
                    height="52"
                    rx="10"
                    fill={withAlpha(ELEMENT_HEX[summaries[i].element] || ELEMENT_HEX.Default)}
                    stroke={HAND_COLORS[i] || HAND_COLORS[0]}
                  />
                  <g font-size="10" fill={HAND_COLORS[i] || HAND_COLORS[0]}>
                    <text id={`asc-summary-sign-${i}`} x="-56" y="0" text-anchor="middle" font-size="20">
                      {signSymbol(summaries[i].sign) || summaries[i].sign}
                    </text>
                    <text id={`asc-summary-name-${i}`} x="4" y="0" text-anchor="middle" font-size="12">
                      {signName(summaries[i].sign)} · {summaries[i].time}
                    </text>
                    <text id={`asc-summary-meta-${i}`} x="4" y="14" text-anchor="middle" font-size="9" fill="#cbd5e1">
                      {summaries[i].decLabel} · {summaries[i].orb} · {(QUALITY_ICON[summaries[i].quality] || '') + (summaries[i].quality ? ` ${summaries[i].quality}` : '')} · {ELEMENT_ICON[summaries[i].element] || ELEMENT_ICON.Default}
                    </text>
                  </g>
                </g>
              {/if}
            {/each}
          {/if}
        </svg>

        {#if sigilPositionPercent && hasSigilPayload}
          <div class="pointer-events-none absolute inset-0" aria-hidden="true">
            <div
              class="transition-all duration-300"
              style={`position:absolute; left:${sigilPositionPercent.left}%; top:${sigilPositionPercent.top}%; transform:translate(-50%,-50%);`}
            >
              {#key JSON.stringify(sigilPayload)}
                <ElementSigil
                  size={SIGIL_SIZE}
                  compact={true}
                  sunElement={sigilPayload.sunElement}
                  moonElement={sigilPayload.moonElement}
                  dayElement={sigilPayload.dayElement}
                  ascElement={sigilPayload.ascElement}
                  dayRulerKey={sigilPayload.dayRulerKey}
                  sunSign={sigilPayload.sunSign}
                  moonSign={sigilPayload.moonSign}
                  daySign={sigilPayload.daySign}
                  ascSign={sigilPayload.ascSign}
                />
              {/key}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div class="flex flex-wrap gap-2 text-xs text-slate-200">
      {#each normalized as range, idx}
        <span
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-700/60"
          style={`background: linear-gradient(145deg, rgba(15,23,42,0.85), rgba(15,23,42,0.6)); color: #e2e8f0; box-shadow: 0 0 0 1px ${(HAND_COLORS[idx] || HAND_COLORS[0])}44;`}
        >
          {range.label}
        </span>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-slate-400">Generate a chart to see the ascendant clock.</p>
  {/if}
</div>
