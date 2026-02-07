<script>
  import { formatDateLabel, toDate } from '$lib/astro/format';
  import { extractPointRanges, extractSubjects } from '$lib/astro/advanced';
  import { DAY_RULERS, ELEMENT_HEX, ELEMENT_ICON, QUALITY_ICON, signName, signSymbol } from '$lib/astro/signs';
  import CardHeader from '$components/shared/CardHeader.svelte';
  import MoonClock from '$components/shared/MoonClock.svelte';

  export let response = null;
  export let onRequestTimeRangeSweeps = null;
  export let loading = false;
  let collapsed = true;

  const normalizeId = (value, fallback = 'entry') =>
    String(value || fallback)
      .trim()
      .toLowerCase()
      .replace(/[\s/]+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');

  const illuminationDisplay = (entry) => {
    const val = entry?.illumination_percentage ?? entry?.illumination;
    if (typeof val === 'number') return `${val.toFixed(1)}%`;
    if (typeof val === 'string') return val;
    return '';
  };

  const phaseIconFor = (entry) =>
    entry?.phase_emoji || entry?.phase_icon || entry?.lunar_phase_icon || entry?.phaseEmoji || '🌙';
  const phaseLabelFor = (entry) => entry?.phase || entry?.lunar_phase || entry?.moon_phase || '';

  const mapEntry = (entry) => ({
    id: normalizeId(entry?.id || entry?.label || entry?.start || entry?.timestamp || 'moon'),
    start: formatDateLabel(entry.start || entry.timestamp),
    end: formatDateLabel(entry.end),
    sign: signName(entry.sign),
    signKey: entry.sign || '',
    signIcon: signSymbol(entry.sign),
    element: entry.element || '',
    elementIcon: ELEMENT_ICON[entry.element] || '',
    elementStyle: `color: ${ELEMENT_HEX[entry.element] || ELEMENT_HEX.Default};`,
    quality: entry.quality || '',
    qualityIcon: QUALITY_ICON[entry.quality] || '',
    illumination: illuminationDisplay(entry),
    phaseIcon: phaseIconFor(entry),
    phaseLabel: phaseLabelFor(entry),
  });

  $: ranges = extractPointRanges(response, 'moon') || [];
  $: subjects = extractSubjects(response);
  $: primarySubject = subjects?.primary || null;
  $: moonAnchor = toDate(ranges?.[0]?.anchor || primarySubject?.iso_formatted_local_datetime || primarySubject?.timestamp);
  $: dayRulerKey = moonAnchor ? DAY_RULERS[moonAnchor.getDay()] : '';
  $: subjectElements = primarySubject
    ? {
        sunElement: primarySubject.sun?.element || '',
        moonElement: primarySubject.moon?.element || '',
        dayElement: dayRulerKey ? primarySubject?.[dayRulerKey]?.element || '' : '',
        dayRulerKey: dayRulerKey || '',
        ascElement: primarySubject.moon?.element || '',
        sunSign: primarySubject.sun?.sign || '',
        moonSign: primarySubject.moon?.sign || '',
        daySign: dayRulerKey ? primarySubject?.[dayRulerKey]?.sign || '' : '',
        ascSign: primarySubject.ascendant?.sign || primarySubject.asc?.sign || '',
      }
    : null;

  $: if (!collapsed && response && onRequestTimeRangeSweeps && !ranges.length) {
    onRequestTimeRangeSweeps('moon');
  }
</script>

<div class="flowbite-card space-y-4">
  <div class="card-head card-head-inline">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Moon</p>
      <h2>Cycle &amp; Range</h2>
    </div>
    <div class="card-head-actions">
      <button
        type="button"
        class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition"
        on:click={() => (collapsed = !collapsed)}
        aria-expanded={!collapsed}
        aria-controls="adv-moon-clock-panel"
        aria-label={collapsed ? 'Expand moon panel' : 'Collapse moon panel'}
      >
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
        </svg>
      </button>
    </div>
  </div>

  {#if !collapsed}
    <div id="adv-moon-clock-panel" class="space-y-4">
      {#if !response}
        <p class="text-sm text-slate-400">Generate a chart to see the lunar clock, next sign, and month-long breakdown.</p>
      {:else if !ranges.length}
        <p class="text-sm text-slate-400">{loading ? 'Loading moon range...' : 'Range data not loaded yet.'}</p>
      {:else}
        <div data-clock="moon" id="moon-clock">
          <MoonClock ranges={ranges} subjectElements={subjectElements} />
        </div>
        {#each ranges as range}
          <div class="space-y-2">
            <CardHeader
              label={range.label || range.id || 'Moon cycle'}
              value={`Anchor: ${formatDateLabel(range.anchor) || formatDateLabel(toDate(range.entries?.[0]?.start))}`}
              badge={`${(range.entries || []).length} stops`}
            />
            <div class="overflow-x-auto">
              <table
                class="min-w-full text-sm"
                id={`moon-range-table-${normalizeId(range.id || range.label || 'moon')}`}
                data-range-table="moon"
                data-range-id={normalizeId(range.id || range.label || 'moon')}
              >
                <thead class="text-slate-400">
                  <tr>
                    <th class="py-2 pr-3 text-left">Start</th>
                    <th class="py-2 pr-3 text-left">End</th>
                    <th class="py-2 pr-3 text-left">Sign</th>
                    <th class="py-2 pr-3 text-left">Element</th>
                    <th class="py-2 pr-3 text-left">Quality</th>
                    <th class="py-2 pr-3 text-left">Phase</th>
                    <th class="py-2 pr-3 text-left">Illumination</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  {#each (range.entries || []).map(mapEntry) as entry}
                    <tr data-range-entry="moon" data-entry-id={entry.id}>
                      <td class="py-2 pr-3">{entry.start || '—'}</td>
                      <td class="py-2 pr-3">{entry.end || '—'}</td>
                      <td class="py-2 pr-3">{entry.sign} {entry.signIcon}</td>
                      <td class="py-2 pr-3">
                        <span style={entry.elementStyle}>
                          {entry.elementIcon} {entry.element || '—'}
                        </span>
                      </td>
                      <td class="py-2 pr-3">{entry.qualityIcon} {entry.quality || '—'}</td>
                      <td class="py-2 pr-3">{entry.phaseIcon} {entry.phaseLabel || '—'}</td>
                      <td class="py-2 pr-3">{entry.illumination || '—'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>
