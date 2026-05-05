<script>
  import { formatDateLabel, toDate } from '$lib/astro/format';
  import { extractPointSignRanges } from '$lib/astro/advanced';
  import {
    ACTIVE_POINTS,
    ELEMENT_HEX,
    ELEMENT_ICON,
    POINT_ICONS,
    QUALITY_ICON,
    signName,
    signSymbol,
  } from '$lib/astro/signs';
  import CardHeader from '$components/shared/CardHeader.svelte';

  export let response = null;
  export let onRequestTimeRangeSweeps = null;
  export let loadingMap = {};
  export let mode = 'natal';

  let collapsed = true;
  let selectedPoint = 'sun';

  const normalizePointKey = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]+/g, '');

  const pointOptions = (ACTIVE_POINTS || []).map((point) => ({
    key: point.key,
    label: point.label,
    emoji: point.emoji || POINT_ICONS[point.key] || '',
  }));

  const formatDateLabelShortYear = (value) => {
    const date = toDate(value);
    if (!date) return '';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const mapEntry = (entry) => ({
    start: formatDateLabelShortYear(entry.start || entry.timestamp),
    end: formatDateLabelShortYear(entry.end),
    sign: signName(entry.sign),
    signIcon: signSymbol(entry.sign),
    element: entry.element || '',
    elementIcon: ELEMENT_ICON[entry.element] || '',
    elementStyle: `color: ${ELEMENT_HEX[entry.element] || ELEMENT_HEX.Default};`,
    quality: entry.quality || '',
    qualityIcon: QUALITY_ICON[entry.quality] || '',
  });

  const HOUR_MS = 60 * 60 * 1000;
  const HOURS_PER_DAY = 24;
  const DAYS_PER_MONTH = 30;
  const DAYS_PER_YEAR = 365.25;

  const computeAvgHours = (ranges) => {
    const durations = [];
    (ranges || []).forEach((range) => {
      (range.entries || []).forEach((entry) => {
        const start = toDate(entry.start || entry.timestamp);
        const end = toDate(entry.end);
        if (!start || !end) return;
        const hours = (end.getTime() - start.getTime()) / HOUR_MS;
        if (Number.isFinite(hours) && hours > 0) {
          durations.push(hours);
        }
      });
    });
    if (!durations.length) return null;
    const total = durations.reduce((sum, value) => sum + value, 0);
    return total / durations.length;
  };

  const formatVelocity = (avgHours) => {
    if (!Number.isFinite(avgHours) || avgHours <= 0) {
      return { label: '—', bandIndex: 0, bandProgress: 0 };
    }
    if (avgHours < 48) {
      return {
        label: `${avgHours.toFixed(1)} hours`,
        bandIndex: 0,
        bandProgress: Math.min(avgHours / 48, 1),
      };
    }
    const days = avgHours / HOURS_PER_DAY;
    if (days < 60) {
      return {
        label: `${days.toFixed(1)} days`,
        bandIndex: 1,
        bandProgress: Math.min(days / 60, 1),
      };
    }
    const months = days / DAYS_PER_MONTH;
    if (months < 36) {
      return {
        label: `${months.toFixed(1)} months`,
        bandIndex: 2,
        bandProgress: Math.min(months / 36, 1),
      };
    }
    const years = days / DAYS_PER_YEAR;
    return {
      label: `${years.toFixed(1)} years`,
      bandIndex: 3,
      bandProgress: Math.min(years / 50, 1),
    };
  };

  $: selectedKey = normalizePointKey(selectedPoint);
  $: selectedOption = pointOptions.find((opt) => opt.key === selectedKey) || {
    key: selectedKey,
    label: selectedKey || 'Point',
    emoji: POINT_ICONS[selectedKey] || '',
  };
  $: allPointRanges = extractPointSignRanges(response) || [];
  $: pointRanges = allPointRanges.filter(
    (range) => normalizePointKey(range.point_key || range.pointKey) === selectedKey
  );
  $: avgHours = computeAvgHours(pointRanges);
  $: velocity = formatVelocity(avgHours);
  $: isLoading = Boolean(loadingMap?.[selectedKey]);
  $: refreshState = isLoading ? 'Refreshing…' : '';

  $: if (!collapsed && response && onRequestTimeRangeSweeps && selectedKey && !pointRanges.length) {
    onRequestTimeRangeSweeps(selectedKey);
  }

  const segments = ['Hours', 'Days', 'Months', 'Years'];

  const handleSelection = (event) => {
    const next = normalizePointKey(event?.target?.value);
    if (!next) return;
    selectedPoint = next;
    if (!collapsed && response && onRequestTimeRangeSweeps) {
      onRequestTimeRangeSweeps(next);
    }
  };

  const handleRefresh = () => {
    if (!response || !onRequestTimeRangeSweeps || !selectedKey) return;
    onRequestTimeRangeSweeps(selectedKey, { force: true });
  };
</script>

<div class="flowbite-card space-y-4">
  <div class="card-head card-head-inline">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">{selectedOption.emoji} {selectedOption.label}</p>
      <h2>Ingresses</h2>
    </div>
    <div class="card-head-actions flex items-center gap-2">
      <button
        type="button"
        class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition"
        on:click={() => (collapsed = !collapsed)}
        aria-expanded={!collapsed}
        aria-controls="adv-point-ingress-panel"
        aria-label={collapsed ? 'Expand ingress panel' : 'Collapse ingress panel'}
      >
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
        </svg>
      </button>
    </div>
  </div>

  {#if !collapsed}
    <div id="adv-point-ingress-panel" class="space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <label for="adv-point-ingress-point-select" class="text-xs uppercase tracking-wide text-slate-400">Point</label>
        <select
          id="adv-point-ingress-point-select"
          name="adv-point-ingress-point-select"
          class="rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 px-3 py-2 text-sm"
          on:change={handleSelection}
          bind:value={selectedPoint}
          disabled={isLoading}
        >
          {#each pointOptions as option}
            <option value={option.key}>{option.emoji ? `${option.emoji} ` : ''}{option.label}</option>
          {/each}
        </select>
        <button
          type="button"
          class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
          on:click={handleRefresh}
          aria-label="Refresh ingress ranges"
          disabled={isLoading}
        >
          <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v6h6" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 20v-6h-6" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 8a8 8 0 00-14-3" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16a8 8 0 0014 3" />
          </svg>
        </button>
        {#if refreshState}
          <span class="text-xs text-cyan-200/80">{refreshState}</span>
        {/if}
      </div>

      {#if !response}
        <p class="text-sm text-slate-400">Generate a chart to see upcoming sign changes.</p>
      {:else if !pointRanges.length}
        <p class="text-sm text-slate-400">{isLoading ? 'Loading ingress range...' : 'Range data not loaded yet.'}</p>
      {:else}
        <div class="space-y-3 rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
          <div class="flex items-center justify-between">
            <p class="text-sm text-slate-300 flex items-center gap-2">
              <span class="text-xs uppercase tracking-wider text-slate-500">Velocity:</span>
              Avg time in a sign
              <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-200">
                <svg class="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2M7.76 5.76l1.41 1.41M5 12H3m2.76 6.24l1.41-1.41M12 21v-2m6.24-1.76-1.41-1.41M21 12h-2m-1.76-6.24-1.41 1.41" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 7a5 5 0 1 1 0 10" />
                </svg>
              </span>
            </p>
            <p class="text-sm font-semibold text-slate-100">{velocity.label}</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden flex">
              {#each segments as segment, idx}
                <div class="relative flex-1">
                  <span
                    class={`absolute inset-y-0 left-0 ${idx <= velocity.bandIndex ? 'bg-cyan-400/70' : 'bg-slate-700/60'}`}
                    style={`width: ${idx < velocity.bandIndex ? 100 : idx === velocity.bandIndex ? velocity.bandProgress * 100 : 0}%`}
                  ></span>
                </div>
              {/each}
            </div>
            <span class="text-xs uppercase tracking-wide text-slate-400">{segments[velocity.bandIndex]}</span>
          </div>
        </div>

        {#each pointRanges as range}
          <div class="space-y-2">
            <CardHeader
              label={range.label || range.id || 'Ingress track'}
              value={`Anchor: ${formatDateLabel(range.anchor) || formatDateLabel(toDate(range.entries?.[0]?.start))}`}
              badge={`${(range.entries || []).length} stops`}
            />
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="text-slate-400">
                  <tr>
                    <th class="py-2 pr-3 text-left">Start</th>
                    <th class="py-2 pr-3 text-left">End</th>
                    <th class="py-2 pr-3 text-left">Sign</th>
                    <th class="py-2 pr-3 text-left">Element</th>
                    <th class="py-2 pr-3 text-left">Quality</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  {#each (range.entries || []).map(mapEntry) as entry}
                    <tr>
                      <td class="py-2 pr-3">{entry.start || '—'}</td>
                      <td class="py-2 pr-3">{entry.end || '—'}</td>
                      <td class="py-2 pr-3">{entry.sign} {entry.signIcon}</td>
                      <td class="py-2 pr-3">
                        <span style={entry.elementStyle}>
                          {entry.elementIcon} {entry.element || '—'}
                        </span>
                      </td>
                      <td class="py-2 pr-3">{entry.qualityIcon} {entry.quality || '—'}</td>
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
