<script>
  import { collectPoints } from '$lib/astro/advanced';
  import { formatDateLabel, formatDateShort, formatModeLabel, toDate } from '$lib/astro/format';
  import { DAY_RULERS, ELEMENT_HEX, ELEMENT_ICON, POINT_SYMBOLS, signName, signSymbol } from '$lib/astro/signs';
  import { rangeStore } from '$lib/state/rangeStore';
  import RangeForm from '$components/workbench/RangeForm.svelte';
  import CardHeader from '$components/shared/CardHeader.svelte';
  import ElementSigil from '$components/shared/ElementSigil.svelte';
  import MajorAspectIcon from '$components/shared/MajorAspectIcon.svelte';

  export let rangeResult = null;
  export let mode = 'natal';
  export let onRange = null;
  export let onNavigate = null;
  export let loading = false;
  let collapsed = true;

  const normalizeKey = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

  const pickPoint = (points, key) => {
    if (!points || !key) return null;
    if (points[key]) return points[key];
    const target = normalizeKey(key);
    const match = Object.entries(points).find(([name]) => normalizeKey(name) === target);
    return match ? match[1] : null;
  };

  const formatWeekday = (date) => {
    if (!(date instanceof Date)) return '';
    try {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } catch (err) {
      return '';
    }
  };

  const resolveCadence = (granularity) => {
    const norm = String(granularity || '').toLowerCase();
    if (norm === 'month') return 'month';
    if (norm === 'hour' || norm === 'minute') return 'hour';
    return 'day';
  };

  const computeMoonIllumination = (subject = {}, moon = {}) => {
    if (typeof moon.illumination_percentage === 'number') return `${moon.illumination_percentage.toFixed(1)}%`;
    if (typeof moon.illumination === 'number') return `${moon.illumination.toFixed(1)}%`;
    if (typeof moon.illumination_percentage === 'string') return moon.illumination_percentage;
    if (typeof moon.illumination === 'string') return moon.illumination;
    const phase = subject?.lunar_phase || {};
    if (typeof phase.illumination === 'number') return `${phase.illumination.toFixed(1)}%`;
    if (phase.illumination) return phase.illumination;
    return '';
  };

  const buildPlacement = (points, key, label, extras = {}) => {
    const point = pickPoint(points, key);
    if (!point) return null;
    const norm = normalizeKey(key);
    return {
      key: norm,
      id: `${norm}-${label}`.replace(/\s+/g, '-').toLowerCase(),
      label,
      icon: POINT_SYMBOLS[normalizeKey(key)] || '★',
      sign: signName(point.sign),
      signIcon: signSymbol(point.sign),
      element: point.element || '',
      retrograde: Boolean(point.retrograde),
      illumination: extras.illumination || '',
      phaseIcon: extras.phaseIcon || '',
      phaseLabel: extras.phaseLabel || '',
      orb:
        typeof point.position === 'number'
          ? `${point.position.toFixed(2)}°`
          : typeof point.abs_pos === 'number'
            ? `${(point.abs_pos % 30).toFixed(2)}°`
            : '',
    };
  };

  const buildAspectList = (patterns = []) =>
    patterns
      .slice(0, 3)
      .map((pattern) => ({
        id: pattern.id || 'generic',
        label: pattern.name || pattern.geometry || 'Aspect pattern',
      }))
      .filter((entry) => entry.label);

  const resolveTone = (points, cadence, weekdayIdx) => {
    const dayKey = typeof weekdayIdx === 'number' ? DAY_RULERS[weekdayIdx] : null;
    const dayPoint = dayKey ? pickPoint(points, dayKey) : null;
    const sunPoint = pickPoint(points, 'sun');
    const ascPoint = pickPoint(points, 'ascendant');

    let toneSource = null;
    let element = 'Default';
    let sourceLabel = 'Cadence';

    if (cadence === 'month') {
      toneSource = sunPoint;
      element = sunPoint?.element || 'Default';
      sourceLabel = `Sun (${signName(sunPoint?.sign) || '—'})`;
    } else if (cadence === 'hour') {
      toneSource = ascPoint;
      element = ascPoint?.element || 'Default';
      sourceLabel = `Asc (${signName(ascPoint?.sign) || '—'})`;
    } else {
      toneSource = dayPoint;
      element = dayPoint?.element || 'Default';
      sourceLabel = `Day ruler (${signName(dayPoint?.sign) || '—'})`;
    }

    const tone = ELEMENT_HEX[element] || ELEMENT_HEX.Default || '#38bdf8';
    return { tone, element, sourceLabel, dayKey, dayPoint, sunPoint, ascPoint, toneSource };
  };

  const resolveElement = (points, key, aliases = []) => {
    const primary = pickPoint(points, key);
    if (primary?.element) return primary.element;
    for (const alias of aliases) {
      const alt = pickPoint(points, alias);
      if (alt?.element) return alt.element;
    }
    return '';
  };

  const resolveSign = (points, key, aliases = []) => {
    const primary = pickPoint(points, key);
    if (primary?.sign) return primary.sign;
    for (const alias of aliases) {
      const alt = pickPoint(points, alias);
      if (alt?.sign) return alt.sign;
    }
    return '';
  };

  const buildSigilProps = (points, tone, cadence) => {
    const dayKey = tone?.dayKey;
    const sunElement = resolveElement(points, 'sun');
    const moonElement = resolveElement(points, 'moon');
    const dayElement = dayKey
      ? resolveElement(points, dayKey) || tone?.dayPoint?.element || ''
      : tone?.dayPoint?.element || '';
    const dayRulerKey = dayKey || '';
    const sunSign = resolveSign(points, 'sun');
    const moonSign = resolveSign(points, 'moon');
    const daySign = dayKey ? resolveSign(points, dayKey) || tone?.dayPoint?.sign || '' : tone?.dayPoint?.sign || '';

    if (cadence === 'hour') {
      const ascElement =
        resolveElement(points, 'ascendant', ['asc']) || tone?.ascPoint?.element || '';
      const ascSign = resolveSign(points, 'ascendant', ['asc']) || tone?.ascPoint?.sign || '';
      return { sunElement, moonElement, dayElement, ascElement, dayRulerKey, sunSign, moonSign, daySign, ascSign };
    }

    if (cadence === 'day') {
      return { sunElement, moonElement, dayElement, ascElement: '', dayRulerKey, sunSign, moonSign, daySign, ascSign: '' };
    }

    // Month cadence: include sun + day only.
    return { sunElement, moonElement: '', dayElement, ascElement: '', dayRulerKey, sunSign, moonSign: '', daySign, ascSign: '' };
  };

  const formatSnapshot = (snap, idx, cadence) => {
    const ts = toDate(snap?.timestamp);
    const label = ts ? formatDateShort(ts) : 'Snapshot';
    const time = ts ? formatDateLabel(ts) : '';
    const weekday = formatWeekday(ts);
    const weekdayIdx = ts?.getDay?.() ?? null;
    const { points } = collectPoints(snap?.subject || {});
    const moonExtras = {
      illumination: computeMoonIllumination(snap?.subject, points.moon),
      phaseIcon: snap?.subject?.lunar_phase?.moon_emoji || '',
      phaseLabel: snap?.subject?.lunar_phase?.moon_phase_name || '',
    };
    const tone = resolveTone(points, cadence, weekdayIdx);
    const placements = [
      cadence === 'day' && tone.dayKey ? buildPlacement(points, tone.dayKey, 'Day ruler') : null,
      buildPlacement(points, 'sun', 'Sun'),
      buildPlacement(points, 'moon', 'Moon', moonExtras),
      buildPlacement(points, 'ascendant', 'Ascendant'),
    ].filter(Boolean);
    return {
      id: `range-entry-${idx}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-') || idx}`,
      label,
      time,
      timestamp: snap?.timestamp,
      subject: snap?.subject || null,
      weekday,
      cadence,
      tone,
      placements,
      aspects: buildAspectList(snap?.major_aspects || []),
      sigil: buildSigilProps(points, tone, cadence),
      countLabel: `Stop ${idx + 1}`,
    };
  };

  $: snapshots = Array.isArray(rangeResult?.snapshots) ? rangeResult.snapshots : [];
  $: ordered = snapshots
    .slice()
    .sort((a, b) => {
      const at = toDate(a?.timestamp)?.getTime() || 0;
      const bt = toDate(b?.timestamp)?.getTime() || 0;
      return at - bt;
    });
  $: startDate = ordered[0]?.timestamp ? toDate(ordered[0].timestamp) : null;
  $: endDate = ordered.length && ordered[ordered.length - 1]?.timestamp ? toDate(ordered[ordered.length - 1].timestamp) : null;
  $: startLabel = startDate ? formatDateShort(startDate) : '—';
  $: endLabel = endDate ? formatDateShort(endDate) : '—';
  $: summaryLine = ordered.length
    ? `${startLabel} → ${endLabel} (${ordered.length} snapshots)`
    : 'Set start and end to see duration.';
  $: cadence = resolveCadence(rangeResult?.granularity || $rangeStore?.granularity);
  $: cadenceLabel =
    cadence === 'month' ? 'Month · Sun-led' : cadence === 'day' ? 'Day · Day ruler' : 'Hour · Asc tone';
  $: entries = ordered.map((snap, idx) => formatSnapshot(snap, idx, cadence));
</script>

<div class="flowbite-card space-y-4" id="adv-range-panel">
  <div class="card-head">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Future vision</p>
      <h2>Range explorer</h2>
      <p class="text-xs text-slate-400">Transit and dual modes only.</p>
    </div>
    <div class="card-head-actions">
      {#if entries.length}
        <span class="badge">{entries.length} stops</span>
      {/if}
      <span class="badge">{formatModeLabel(mode)}</span>
      <button
        type="button"
        class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition"
        on:click={() => (collapsed = !collapsed)}
        aria-expanded={!collapsed}
        aria-controls="adv-range-panel-body"
        aria-label={collapsed ? 'Expand range panel' : 'Collapse range panel'}
      >
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
        </svg>
      </button>
    </div>
  </div>

  {#if !collapsed}
    <div id="adv-range-panel-body" class="space-y-4">
      <RangeForm on:range={onRange} {loading} />

      <CardHeader label="Range window" value={summaryLine} badge={cadenceLabel}>
        <svelte:fragment slot="right">
          <span class="badge">Mode: {formatModeLabel(mode)}</span>
        </svelte:fragment>
      </CardHeader>

      <div id="adv-range-results" class="range-grid">
        {#if entries.length}
          {#each entries as entry (entry.id)}
            <div class="range-card" style={`--tone:${entry.tone.tone};`}>
              <div class="range-card-head">
                <div>
                  <p class="range-kicker">{entry.weekday || 'Snapshot'}</p>
                  <p class="range-date">{entry.label}</p>
                  <p class="range-time">{entry.time || '—'}</p>
                </div>
                <div class="range-badges">
                  <span class="badge range-badge-label">{entry.tone.sourceLabel}</span>
                  {#if typeof onNavigate === 'function'}
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-cyan-400 hover:text-white transition"
                      on:click={() => onNavigate(entry)}
                    >
                      <span>Navigate</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  {/if}
                  <div class="range-sigil-head">
                    <ElementSigil {...entry.sigil} size={50} compact className="range-sigil-figure" />
                  </div>
                </div>
              </div>

              <div class="range-card-body compact">
                <div class="range-column">
                  <div class="range-column-head">
                    <span class="tag">Transit</span>
                    {#if entry.tone.dayKey && cadence === 'day'}
                      <span class="micro-label flex items-center gap-2">
                        <span aria-hidden="true">{POINT_SYMBOLS[entry.tone.dayKey]}</span>
                        {signName(entry.tone.dayPoint?.sign) || 'Day ruler'}
                      </span>
                    {:else if cadence === 'hour'}
                      <span class="micro-label flex items-center gap-2">
                        <span aria-hidden="true">{POINT_SYMBOLS.ascendant}</span>
                        {signName(entry.tone.ascPoint?.sign) || 'Ascendant'}
                      </span>
                    {:else}
                      <span class="micro-label flex items-center gap-2">
                        <span aria-hidden="true">{POINT_SYMBOLS.sun}</span>
                        {signName(entry.tone.sunPoint?.sign) || 'Sun'}
                      </span>
                    {/if}
                  </div>

                  <div class="placement-grid compact">
                    {#each entry.placements as placement (placement.id)}
                      <div class="placement-chip compact">
                        <div class="chip-icon" aria-hidden="true">{placement.icon}</div>
                        <div class="chip-main">
                          <p class="chip-label">{placement.label}</p>
                          <p class="chip-value">{placement.sign} {placement.signIcon}</p>
                        </div>
                        <div class="chip-meta">
                          {#if placement.element}
                            <span class="chip-pill" title={`Element ${placement.element}`}>
                              {ELEMENT_ICON[placement.element] || placement.element}
                            </span>
                          {/if}
                          {#if placement.illumination}
                            <span class="chip-pill" title="Illumination">{placement.illumination}</span>
                          {/if}
                          {#if placement.phaseIcon}
                            <span class="chip-pill" title={placement.phaseLabel || 'Lunar phase'}>{placement.phaseIcon}</span>
                          {/if}
                          {#if placement.orb}<span class="chip-pill chip-pill--soft" title="Orb">{placement.orb}</span>{/if}
                          {#if placement.retrograde}<span class="chip-pill chip-pill--alert" title="Retrograde">Rx</span>{/if}
                        </div>
                      </div>
                    {/each}
                  </div>

                  {#if entry.aspects.length}
                    <div class="aspect-row compact" aria-label="Transit aspect patterns">
                      {#each entry.aspects as aspect, idx (`${aspect.id}-${idx}`)}
                        <span class="aspect-chip">
                          <MajorAspectIcon patternId={aspect.id} size={22} />
                          {aspect.label}
                        </span>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        {:else}
          <div class="range-empty">
            <p class="text-sm text-slate-300">Pick a window and tap Visualize to see each stop along the way.</p>
            <p class="text-xs text-slate-500">Cards auto-tint by the ruling element of each step.</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .range-grid {
    display: grid;
    gap: 12px;
  }

  @media (min-width: 768px) {
    .range-grid {
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    }
  }

  .range-card {
    position: relative;
    padding: 14px;
    border-radius: 18px;
    border: 1px solid color-mix(in srgb, var(--tone, #38bdf8) 55%, #0f172a);
    background:
      radial-gradient(circle at 14% 18%, color-mix(in srgb, var(--tone, #38bdf8) 18%, transparent), transparent 44%),
      radial-gradient(circle at 86% 14%, color-mix(in srgb, var(--tone, #38bdf8) 12%, transparent), transparent 46%),
      linear-gradient(135deg, color-mix(in srgb, var(--tone, #38bdf8) 16%, #0b1221), rgba(10, 16, 28, 0.75));
    box-shadow:
      0 16px 48px rgba(0, 0, 0, 0.45),
      inset 0 0 0 1px rgba(255, 255, 255, 0.02);
  }

  .range-card::after {
    content: '';
    position: absolute;
    inset: 10px;
    border-radius: 14px;
    pointer-events: none;
    background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--tone, #38bdf8) 10%, transparent), transparent 60%);
    opacity: 0.8;
  }

  .range-card-head {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 10px;
  }

  @media (min-width: 640px) {
    .range-card-head {
      grid-template-columns: 1fr auto;
      align-items: start;
    }
  }

  .range-kicker {
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--tone, #38bdf8) 70%, #cbd5e1 30%);
    font-weight: 700;
  }

  .range-date {
    font-size: 1.1rem;
    font-weight: 700;
    color: #e2e8f0;
    line-height: 1.2;
  }

  .range-time {
    font-size: 0.92rem;
    color: #cbd5e1;
  }

  .range-badges {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-self: flex-start;
  }

  .range-sigil-head {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border-radius: 12px;
    background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--tone, #38bdf8) 10%, transparent), transparent 70%);
    border: 1px dashed color-mix(in srgb, var(--tone, #38bdf8) 35%, #0f172a);
  }

  .range-badge-label {
    font-size: 10px;
    padding: 2px 6px;
  }

  .range-card-body {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    margin-top: 10px;
    align-items: start;
  }

  .range-card-body.compact {
    grid-template-columns: 1fr auto;
  }

  .range-column {
    border: 1px solid color-mix(in srgb, var(--tone, #38bdf8) 22%, #0f172a);
    background: rgba(15, 23, 42, 0.7);
    border-radius: 14px;
    padding: 10px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }


  .range-column-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  .placement-grid {
    display: grid;
    gap: 8px;
  }

  .placement-grid.compact {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .placement-chip {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(15, 23, 42, 0.76);
    border-radius: 12px;
    padding: 8px;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
  }

  .placement-chip.compact {
    padding: 8px 10px;
  }

  .chip-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--tone, #38bdf8) 18%, #0b1221);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    color: #e0f2fe;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  .chip-main {
    flex: 1;
    min-width: 0;
  }

  .chip-label {
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #cbd5e1;
    font-weight: 700;
  }

  .chip-value {
    font-size: 14px;
    color: #e2e8f0;
  }

  .chip-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .chip-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    border-radius: 9999px;
    background: rgba(226, 232, 240, 0.08);
    border: 1px solid rgba(148, 163, 184, 0.24);
    font-size: 11px;
    color: #e2e8f0;
    line-height: 1.2;
  }

  .chip-pill--soft {
    background: rgba(56, 189, 248, 0.12);
    border-color: rgba(56, 189, 248, 0.35);
    color: #bae6fd;
  }

  .chip-pill--alert {
    background: rgba(248, 113, 113, 0.2);
    border-color: rgba(248, 113, 113, 0.45);
    color: #fecdd3;
  }

  .aspect-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
  }

  .aspect-row.compact .aspect-chip {
    padding: 5px 7px;
    font-size: 11px;
  }

  .aspect-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 10px;
    background: rgba(14, 165, 233, 0.08);
    border: 1px solid rgba(14, 165, 233, 0.32);
    font-size: 12px;
    color: #c7d2fe;
  }


  .range-empty {
    padding: 14px;
    border: 1px dashed #334155;
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.65);
  }
</style>
