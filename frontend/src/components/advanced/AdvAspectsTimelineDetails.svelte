<script>
  import { aspectIcon, aspectColorClass, aspectHexColor } from '$lib/astro/aspects';
  import { POINT_SYMBOLS, signName, signSymbol } from '$lib/astro/signs';
  import { formatDuration } from '$lib/astro/timeline/spans';

  export let span = null;
  export let viewStart = NaN;
  export let viewEnd = NaN;
  export let pinTs = NaN;
  export let onClose = () => {};

  const normalizeKey = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, '_');
  const icon = (label) => POINT_SYMBOLS[normalizeKey(label)] || '★';
  const fmtTs = (ms) => {
    if (!Number.isFinite(ms)) return '—';
    try { return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return new Date(ms).toISOString().slice(0, 16).replace('T', ' '); }
  };
  const fmtApproxTs = (ms) => Number.isFinite(ms) ? `~ ${fmtTs(ms)}` : '—';
  const fmtOrb = (v) => Number.isFinite(v) ? `${v.toFixed(2)}°` : '—';
  const DEFAULT_ASPECT_ORBS = {
    conjunction: 8,
    opposition: 8,
    square: 7,
    trine: 7,
    sextile: 5,
    quincunx: 3,
    semisextile: 2,
    semisquare: 2,
    sesquiquadrate: 2,
    quintile: 2,
    biquintile: 2,
    septile: 1,
    novile: 2,
  };
  const firstFinite = (...values) => {
    for (const value of values) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return Math.abs(numeric);
    }
    return NaN;
  };
  const aspectKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  const boundaryOrb = (item, side) => {
    const explicit = side === 'start'
      ? firstFinite(item?.startOrb, item?.start_orb, item?.orbStart, item?.orb_start)
      : firstFinite(item?.endOrb, item?.end_orb, item?.orbEnd, item?.orb_end);
    if (Number.isFinite(explicit)) return explicit;
    const maxOrb = firstFinite(item?.maxOrb, item?.max_orb, DEFAULT_ASPECT_ORBS[aspectKey(item?.aspectType)]);
    if (Number.isFinite(maxOrb)) return maxOrb;
    const minOrb = firstFinite(item?.minOrb);
    return Number.isFinite(minOrb) ? Math.max(minOrb, 3) : 3;
  };
  const estimateOrbAt = (item, ts) => {
    if (!item || !Number.isFinite(ts)) return NaN;
    if (ts < item.startAt || ts > item.endAt) return NaN;
    const minOrb = firstFinite(item.minOrb);
    const startOrb = boundaryOrb(item, 'start');
    const endOrb = boundaryOrb(item, 'end');
    if (!Number.isFinite(minOrb)) return NaN;
    if (ts <= item.exactAt) {
      const ratio = item.exactAt > item.startAt ? (ts - item.startAt) / (item.exactAt - item.startAt) : 1;
      return startOrb + (minOrb - startOrb) * Math.max(0, Math.min(1, ratio));
    }
    const ratio = item.endAt > item.exactAt ? (ts - item.exactAt) / (item.endAt - item.exactAt) : 1;
    return minOrb + (endOrb - minOrb) * Math.max(0, Math.min(1, ratio));
  };
  const movementLabel = (v) => {
    const s = String(v || '').toLowerCase();
    if (s.includes('applying')) return 'Applying';
    if (s.includes('separating')) return 'Separating';
    return '—';
  };
  const ownerLabel = (value) => String(value || '').trim() || 'Transit';
  const signGlyph = (value) => signSymbol(value);

  $: visibleStart = span ? Math.max(span.startAt, Number.isFinite(viewStart) ? viewStart : span.startAt) : NaN;
  $: visibleEnd = span ? Math.min(span.endAt, Number.isFinite(viewEnd) ? viewEnd : span.endAt) : NaN;
  $: dur = span ? formatDuration(visibleEnd - visibleStart) : '—';
  $: pinOrbTs = span && Number.isFinite(pinTs) && pinTs >= visibleStart && pinTs <= visibleEnd ? pinTs : NaN;
  $: startOrb = span ? estimateOrbAt(span, visibleStart) : NaN;
  $: pinOrb = span ? estimateOrbAt(span, pinOrbTs) : NaN;
  $: endOrb = span ? estimateOrbAt(span, visibleEnd) : NaN;
  $: movementRef = span
    ? (Number.isFinite(pinTs)
        ? pinTs
        : Math.max(visibleStart, Math.min(visibleEnd, (visibleStart + visibleEnd) / 2)))
    : NaN;
  $: currentMovement = span ? movementLabel(movementRef <= span.exactAt ? 'applying' : 'separating') : '—';
  $: currentMovementClass = currentMovement === 'Applying' ? 'detail-val--applying' : currentMovement === 'Separating' ? 'detail-val--separating' : '';
  $: glyph = span ? aspectIcon(span.aspectType) : '';
  $: colorCls = span ? aspectColorClass(span.aspectType) : '';
  $: hexColor = span ? aspectHexColor(span.aspectType) : '#94a3b8';
  $: isClipped = span ? span.confidence !== 'full' || visibleStart > span.startAt || visibleEnd < span.endAt : false;
  $: passes = Array.isArray(span?.passes) ? span.passes : [];
</script>

{#if span}
  <div id="advanced-aspects-timeline-details-panel" class="details-panel timeline-details-panel advanced-aspects-timeline-details-panel" data-selected-span-id={span.id} data-aspect-type={span.aspectType} style="--accent:{hexColor}">
    <div class="details-head timeline-details-header">
      <div class="details-title timeline-details-title">
        <span class="detail-icon timeline-details-point-icon timeline-details-point-icon--left">{icon(span.left)}</span>
        <span class="timeline-details-aspect-icon {colorCls}">{glyph}</span>
        <span class="detail-icon timeline-details-point-icon timeline-details-point-icon--right">{icon(span.right)}</span>
        <span class="detail-label timeline-details-aspect-label">
          <span class="owner-chip timeline-details-owner-chip">{ownerLabel(span.leftOwner)}</span>
          {span.left}{#if signGlyph(span.leftSign)} <span class="timeline-details-sign" title={signName(span.leftSign)}>{signGlyph(span.leftSign)}</span>{/if} {span.aspectType}
          <span class="owner-chip timeline-details-owner-chip">{ownerLabel(span.rightOwner)}</span>
          {span.right}{#if signGlyph(span.rightSign)} <span class="timeline-details-sign" title={signName(span.rightSign)}>{signGlyph(span.rightSign)}</span>{/if}
          {#if span.isAspectPass}
            <span class="owner-chip timeline-details-owner-chip">Pass {span.seriesIndex}/{span.seriesCount}</span>
          {/if}
        </span>
      </div>
      <button type="button" id="advanced-aspects-timeline-details-close" class="close-btn timeline-details-close" on:click={onClose} aria-label="Close details">✕</button>
    </div>

    {#if isClipped}
      <div class="details-note timeline-details-clipped-note">
        Displayed start/end are clipped to the current timeline view; zooming changes this visible lifecycle segment.
      </div>
    {/if}

    <div class="details-grid timeline-details-grid">
      <div class="detail-row timeline-details-row timeline-details-row--start">
        <span class="detail-key">Start</span>
        <span class="detail-val">{fmtTs(visibleStart)}</span>
      </div>
      <div class="detail-row timeline-details-row timeline-details-row--exact">
        <span class="detail-key">Exact approx.</span>
        <span class="detail-val detail-val--accent">{fmtApproxTs(span.exactAt)}</span>
      </div>
      <div class="detail-row timeline-details-row timeline-details-row--end">
        <span class="detail-key">End</span>
        <span class="detail-val">{fmtTs(visibleEnd)}</span>
      </div>
      <div class="detail-row timeline-details-row timeline-details-row--orb">
        <span class="detail-key">Pin orb</span>
        <span class="detail-val detail-val--accent">{fmtOrb(pinOrb)}</span>
      </div>
      <div class="detail-row timeline-details-row timeline-details-row--start-orb">
        <span class="detail-key">Start orb</span>
        <span class="detail-val">{fmtOrb(startOrb)}</span>
      </div>
      <div class="detail-row timeline-details-row timeline-details-row--end-orb">
        <span class="detail-key">End orb</span>
        <span class="detail-val">{fmtOrb(endOrb)}</span>
      </div>
      <div class="detail-row timeline-details-row timeline-details-row--duration">
        <span class="detail-key">Duration</span>
        <span class="detail-val">{dur}</span>
      </div>
      <div class="detail-row timeline-details-row timeline-details-row--owners">
        <span class="detail-key">Owners</span>
        <span class="detail-val">{ownerLabel(span.leftOwner)} -> {ownerLabel(span.rightOwner)}</span>
      </div>
      <div class="detail-row timeline-details-row timeline-details-row--movement">
        <span class="detail-key">Movement</span>
        <span class="detail-val {currentMovementClass}">{currentMovement}</span>
      </div>
      <div class="detail-row timeline-details-row timeline-details-row--samples">
        <span class="detail-key">Samples</span>
        <span class="detail-val">{span.samples}</span>
      </div>
    </div>

    {#if passes.length > 1}
      <div class="passes-summary timeline-details-passes-summary">
        <div class="passes-summary-head">
          <span>Approx. Exact Passes</span>
          <span>{passes.length} passes</span>
        </div>
        <div class="passes-summary-list">
          {#each passes as pass}
            <div class="passes-summary-row" class:passes-summary-row--active={span.id === pass.id}>
              <span class="passes-summary-index">{pass.seriesIndex}/{pass.seriesCount}</span>
              <span class="passes-summary-date">{fmtApproxTs(pass.exactAt)}</span>
              <span class="passes-summary-orb">{fmtOrb(pass.minOrb)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .details-panel {
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--accent) 40%, #1e293b);
    background:
      radial-gradient(circle at 10% 20%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 50%),
      rgba(15, 23, 42, 0.85);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }
  .details-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .details-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 700;
    color: #e2e8f0;
  }
  .detail-icon { font-size: 16px; }
  .detail-label {
    font-size: 12px;
    color: #94a3b8;
    margin-left: 4px;
  }
  .owner-chip {
    display: inline-flex;
    align-items: center;
    padding: 1px 5px;
    margin: 0 3px;
    border-radius: 9999px;
    border: 1px solid color-mix(in srgb, var(--accent) 35%, #334155);
    color: #cbd5e1;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .timeline-details-sign {
    color: #facc15;
    font-size: 1.05em;
    vertical-align: -0.03em;
  }
  .details-note {
    margin: -2px 0 10px;
    padding: 7px 9px;
    border-radius: 8px;
    border: 1px solid rgba(250, 204, 21, 0.22);
    background: rgba(250, 204, 21, 0.08);
    color: #fde68a;
    font-size: 11px;
    line-height: 1.35;
  }
  .close-btn {
    background: none;
    border: none;
    color: #64748b;
    font-size: 14px;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: color 0.15s, background 0.15s;
  }
  .close-btn:hover {
    color: #e2e8f0;
    background: rgba(148,163,184,0.1);
  }
  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 12px;
  }
  .passes-summary {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(148,163,184,0.1);
  }
  .passes-summary-head {
    display: flex;
    justify-content: space-between;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
  }
  .passes-summary-list {
    display: grid;
    gap: 4px;
  }
  .passes-summary-row {
    display: grid;
    grid-template-columns: 44px 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 5px 7px;
    border-radius: 7px;
    background: rgba(15, 23, 42, 0.45);
    border: 1px solid rgba(148,163,184,0.07);
    color: #cbd5e1;
    font-size: 11px;
  }
  .passes-summary-row--active {
    border-color: color-mix(in srgb, var(--accent) 45%, #334155);
    background: color-mix(in srgb, var(--accent) 12%, rgba(15, 23, 42, 0.45));
  }
  .passes-summary-index {
    color: var(--accent);
    font-weight: 700;
  }
  .passes-summary-date {
    min-width: 0;
  }
  .passes-summary-orb {
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
  }
  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 3px 0;
    border-bottom: 1px solid rgba(148,163,184,0.06);
  }
  .detail-key {
    font-size: 11px;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .detail-val {
    font-size: 12px;
    color: #cbd5e1;
    text-align: right;
  }
  .detail-val--accent {
    color: var(--accent);
    font-weight: 700;
  }
  .detail-val--applying {
    color: #22c55e;
    font-weight: 700;
  }
  .detail-val--separating {
    color: #ef4444;
    font-weight: 700;
  }
</style>
