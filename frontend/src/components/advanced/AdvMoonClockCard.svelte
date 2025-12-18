<script>
  import { formatDateLabel, toDate } from '$lib/astro/format';
  import { extractRanges } from '$lib/astro/advanced';
  import { signName, signSymbol } from '$lib/astro/signs';

  export let response = null;

  const mapEntry = (entry) => ({
    start: formatDateLabel(entry.start || entry.timestamp),
    end: formatDateLabel(entry.end),
    sign: signName(entry.sign),
    signIcon: signSymbol(entry.sign),
    element: entry.element || '',
    quality: entry.quality || '',
  });

  $: ranges = extractRanges(response).moon || [];
</script>

<div class="flowbite-card space-y-4">
  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Moon</p>
      <h2>Cycle &amp; Range</h2>
    </div>
  </div>

  <div id="moonClockContainer" class="space-y-4">
    {#if !response || !ranges.length}
      <p class="text-sm text-slate-400">Generate a chart to see the lunar clock, next sign, and month-long breakdown.</p>
    {:else}
      {#each ranges as range}
        <div class="space-y-2">
          <div class="compact-row">
            <div>
              <p class="compact-label">{range.label || range.id || 'Moon cycle'}</p>
              <p class="compact-value">
                Anchor: {formatDateLabel(range.anchor) || formatDateLabel(toDate(range.entries?.[0]?.start))}
              </p>
            </div>
            <span class="badge">{(range.entries || []).length} stops</span>
          </div>
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
                    <td class="py-2 pr-3">{entry.element || '—'}</td>
                    <td class="py-2 pr-3">{entry.quality || '—'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
