<script>
  import { formatDateLabel, toDate } from '$lib/astro/format';
  import { extractRanges } from '$lib/astro/advanced';
  import { signName, signSymbol } from '$lib/astro/signs';
  import CardHeader from '$components/shared/CardHeader.svelte';

  export let response = null;
  let collapsed = false;

  const mapEntry = (entry) => ({
    start: formatDateLabel(entry.start || entry.timestamp),
    end: formatDateLabel(entry.end),
    sign: signName(entry.sign),
    signIcon: signSymbol(entry.sign),
    element: entry.element || '',
    quality: entry.quality || '',
  });

  $: ranges = extractRanges(response).sun || [];
</script>

<div class="flowbite-card space-y-4">
  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Sun</p>
      <h2>Ingresses</h2>
    </div>
    <button
      type="button"
      class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition"
      on:click={() => (collapsed = !collapsed)}
      aria-expanded={!collapsed}
      aria-controls="adv-sun-ingress-panel"
    >
      <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
      </svg>
    </button>
  </div>

  {#if !collapsed}
    <div id="adv-sun-ingress-panel" class="space-y-4">
      {#if !response || !ranges.length}
        <p class="text-sm text-slate-400">Generate a chart to see the Sun's upcoming sign changes.</p>
      {:else}
            {#each ranges as range}
          <div class="space-y-2">
            <CardHeader
              label={range.label || range.id || 'Solar track'}
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
  {/if}
</div>
