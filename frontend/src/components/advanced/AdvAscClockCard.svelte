<script>
  import { formatDateLabel, toDate } from '$lib/astro/format';
  import { extractPointRanges, extractSubjects } from '$lib/astro/advanced';
  import { DAY_RULERS, ELEMENT_HEX, ELEMENT_ICON, QUALITY_ICON, signName, signSymbol } from '$lib/astro/signs';
  import CardHeader from '$components/shared/CardHeader.svelte';
  import AscClock from '$components/shared/AscClock.svelte';
  import ElementSigil from '$components/shared/ElementSigil.svelte';

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

  const mapEntry = (entry) => ({
    id: normalizeId(entry?.id || entry?.label || entry?.start || entry?.timestamp || 'asc'),
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
  });

  $: ranges = extractPointRanges(response, 'ascendant') || [];
  $: subjects = extractSubjects(response);
  $: primarySubject = subjects?.primary || null;
  $: natalSubject = subjects?.natal || null;
  $: ascAnchor = toDate(ranges?.[0]?.anchor || primarySubject?.iso_formatted_local_datetime || primarySubject?.timestamp);
  $: dayRulerKey = ascAnchor ? DAY_RULERS[ascAnchor.getDay()] : '';
  const buildSubjectElements = (subject) =>
    subject
      ? {
          sunElement: subject.sun?.element || '',
          moonElement: subject.moon?.element || '',
          dayElement: dayRulerKey ? subject?.[dayRulerKey]?.element || '' : '',
          dayRulerKey: dayRulerKey || '',
          sunSign: subject.sun?.sign || '',
          moonSign: subject.moon?.sign || '',
          daySign: dayRulerKey ? subject?.[dayRulerKey]?.sign || '' : '',
          ascSign: subject.ascendant?.sign || subject.asc?.sign || '',
        }
      : null;

  $: subjectElements = buildSubjectElements(primarySubject);
  $: natalSubjectElements = buildSubjectElements(natalSubject);

  const buildSigilForEntry = (entry, rangeId) => {
    const normRange = normalizeId(rangeId || '');
    const base = normRange.startsWith('natal') ? natalSubjectElements || subjectElements || {} : subjectElements || {};
    return {
      ...base,
      ascElement: entry.element || '',
      ascSign: entry.signKey || '',
    };
  };

  $: if (!collapsed && response && onRequestTimeRangeSweeps && !ranges.length) {
    onRequestTimeRangeSweeps('ascendant');
  }
</script>

<div class="flowbite-card space-y-4">
  <div class="card-head card-head-inline">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Ascendant</p>
      <h2>Clock &amp; Range</h2>
    </div>
    <div class="card-head-actions">
      <button
        type="button"
        class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition"
        on:click={() => (collapsed = !collapsed)}
        aria-expanded={!collapsed}
        aria-controls="adv-asc-clock-panel"
        aria-label={collapsed ? 'Expand ascendant panel' : 'Collapse ascendant panel'}
      >
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
        </svg>
      </button>
    </div>
  </div>

  {#if !collapsed}
    <div id="adv-asc-clock-panel" class="space-y-4">
      {#if !response}
        <p class="text-sm text-slate-400">Generate a chart to see the ascendant clock and hourly breakdown.</p>
      {:else if !ranges.length}
        <p class="text-sm text-slate-400">{loading ? 'Loading ascendant range...' : 'Range data not loaded yet.'}</p>
      {:else}
        <div data-clock="ascendant" id="ascendant-clock">
          <AscClock ranges={ranges} subjectElements={subjectElements} />
        </div>

        {#each ranges as range}
          {@const rangeId = normalizeId(range.id || range.label || 'asc')}
          <div class="space-y-2">
            <CardHeader
              label={range.label || range.id || 'Ascendant window'}
              value={`Anchor: ${formatDateLabel(range.anchor) || formatDateLabel(toDate(range.entries?.[0]?.start))}`}
              badge={`${(range.entries || []).length} stops`}
            />
            <div class="overflow-x-auto">
              <table
                class="min-w-full text-sm"
                id={`asc-range-table-${rangeId}`}
                data-range-table="ascendant"
                data-range-id={rangeId}
              >
                <thead class="text-slate-400">
                  <tr>
                    <th class="py-2 pr-3 text-left">Start</th>
                    <th class="py-2 pr-3 text-left">End</th>
                    <th class="py-2 pr-3 text-left">Sign</th>
                    <th class="py-2 pr-3 text-left">Sigil</th>
                    <th class="py-2 pr-3 text-left">Element</th>
                    <th class="py-2 pr-3 text-left">Quality</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  {#each (range.entries || []).map(mapEntry) as entry}
                    <tr data-range-entry="ascendant" data-entry-id={entry.id}>
                      <td class="py-2 pr-3">{entry.start || '—'}</td>
                      <td class="py-2 pr-3">{entry.end || '—'}</td>
                      <td class="py-2 pr-3">{entry.sign} {entry.signIcon}</td>
                      <td class="py-2 pr-3">
                        <div class="inline-flex items-center" data-sigil="ascendant" data-entry-id={entry.id}>
                          <ElementSigil
                            {...buildSigilForEntry(entry, rangeId)}
                            size={34}
                            compact
                            id={`asc-sigil-${rangeId}-${entry.id}`}
                          />
                        </div>
                      </td>
                      <td class="py-2 pr-3">
                        <span style={entry.elementStyle}>
                          {entry.elementIcon} {entry.element || '—'}
                        </span>
                      </td>
                      <td class="py-2 pr-3">
                        {entry.qualityIcon} {entry.quality || '—'}
                      </td>
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
