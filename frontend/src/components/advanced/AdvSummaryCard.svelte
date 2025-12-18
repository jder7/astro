<script>
  import { formatDateLabel, formatDegree, toDate } from '$lib/astro/format';
  import { POINT_SYMBOLS, signName, signSymbol } from '$lib/astro/signs';
  import { computeDecan, extractRanges, extractSubjects } from '$lib/astro/advanced';

  export let response = null;
  export let mode = 'natal';

  const resolveCurrentEntry = (range) => {
    if (!range || !Array.isArray(range.entries) || !range.entries.length) return { current: null, next: null, anchor: null };
    const anchor = toDate(range.anchor) || toDate(range.entries[0]?.start || range.entries[0]?.timestamp);
    const entries = range.entries || [];
    const current =
      entries.find((entry) => {
        const start = toDate(entry.start || entry.timestamp);
        const end = toDate(entry.end);
        return start && end && anchor && anchor >= start && anchor < end;
      }) || entries[0];
    const idx = entries.indexOf(current);
    const next = idx !== -1 && entries[idx + 1] ? entries[idx + 1] : null;
    return { current, next, anchor };
  };

  const resolveDegreeValue = (point) => {
    if (!point) return null;
    if (Number.isFinite(point.position)) return point.position;
    if (Number.isFinite(point.abs_pos)) return point.abs_pos % 30;
    return null;
  };

  $: subjects = extractSubjects(response, mode);
  $: ranges = extractRanges(response);
  $: primary = subjects.primary || null;
  $: locationLabel = primary ? [primary.city, primary.nation].filter(Boolean).join(', ') : '';
  $: timestampLabel = primary ? formatDateLabel(primary.iso_formatted_local_datetime || primary.timestamp) : '';

  $: summaryRows = (() => {
    if (!primary) return [];
    const configs = [
      { key: 'sun', label: 'Sun', range: ranges.sun?.[0] },
      { key: 'moon', label: 'Moon', range: ranges.moon?.[0] },
      { key: 'ascendant', label: 'Asc', range: ranges.asc?.[0] },
    ];
    return configs
      .map(({ key, label, range }) => {
        const point = primary?.[key];
        const { current, next } = resolveCurrentEntry(range);
        const activeSign = point?.sign || current?.sign;
        const degreeValue = resolveDegreeValue(point) ?? resolveDegreeValue(current);
        const degree = degreeValue == null ? '' : formatDegree(degreeValue);
        const decan = computeDecan(degreeValue);
        const nextLabel = next ? `${signName(next.sign)} @ ${formatDateLabel(next.start || next.timestamp)}` : '';
        if (!activeSign && !degree) return null;
        return {
          key,
          label,
          icon: POINT_SYMBOLS[key] || '★',
          sign: signName(activeSign),
          signIcon: signSymbol(activeSign),
          element: point?.element || current?.element || '',
          quality: point?.quality || current?.quality || '',
          degree,
          decan,
          next: nextLabel,
        };
      })
      .filter(Boolean);
  })();
</script>

<div class="flowbite-card space-y-4">
  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Overview</p>
      <h2>Summary</h2>
    </div>
    {#if response}
      <span class="badge capitalize">{mode}</span>
    {/if}
  </div>

  <div id="ascSummaryContainer" class="space-y-4">
    {#if !response}
      <p class="text-sm text-slate-400">Generate a chart to see the summary.</p>
    {:else}
      <div class="compact-row">
        <div>
          <p class="compact-label">Moment</p>
          <p class="compact-value">{timestampLabel || 'Requested datetime'}</p>
        </div>
        <div class="text-right">
          <p class="compact-label">Location</p>
          <p class="compact-value">{locationLabel || 'Unknown'}</p>
        </div>
      </div>

      <div class="grid sm:grid-cols-3 gap-3">
        {#if summaryRows.length}
          {#each summaryRows as row}
            <div class="compact-row">
              <div>
                <p class="compact-label flex items-center gap-2">
                  <span aria-hidden="true">{row.icon}</span>
                  {row.label}
                </p>
                <p class="text-sm text-slate-100 flex items-center gap-1">
                  <span>{row.sign}</span>
                  {#if row.signIcon}
                    <span aria-hidden="true">{row.signIcon}</span>
                  {/if}
                </p>
                <p class="text-xs text-slate-400">
                  {row.element || '—'} · {row.quality || '—'}{row.decan ? ` · Decan ${row.decan}` : ''}
                </p>
                <p class="text-xs text-slate-400">{row.degree || '—'}</p>
                {#if row.next}
                  <p class="text-[11px] text-slate-500 mt-1">Next: {row.next}</p>
                {/if}
              </div>
            </div>
          {/each}
        {:else}
          <p class="text-sm text-slate-400">No summary points available.</p>
        {/if}
      </div>
    {/if}
  </div>
</div>
