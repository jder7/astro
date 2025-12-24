<script>
  import { classesForPoint } from '$lib/astro/summary';

  export let summary = { sections: [], ranges: [], aspects: [], context: {}, rawAspects: [] };

  const slugify = (value) =>
    String(value || 'section')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
</script>

<div class="flowbite-card space-y-4" id="esoteric-summary-card">
  <div class="card-head">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Summary</p>
      <h2>Overlay Highlights</h2>
    </div>
    <div class="card-head-actions">
      <span class="badge">{summary.sections?.length || 0} sections</span>
    </div>
  </div>

  {#if summary.sections && summary.sections.length}
    <div class="space-y-4">
      {#each summary.sections as section}
        <div class="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-3 min-w-0" id={`summary-section-${slugify(section?.meta?.title)}`}>
          <div class="card-head card-head-inline">
            <div class="min-w-0">
              <p class="section-title text-xs">{section.meta?.title || 'Section'}</p>
              <p class="text-sm text-slate-300 break-words">
                {[section.meta?.datetime, section.meta?.tz].filter(Boolean).join(' • ') || '—'}
              </p>
              {#if section.meta?.location}
                <p class="text-xs text-slate-400 break-words">{section.meta.location}</p>
              {/if}
            </div>
            <div class="card-head-actions">
              <span class="badge">{section.points?.length || 0} points</span>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            {#each section.points || [] as point}
              <div class="border border-slate-800 rounded-xl p-3 bg-slate-900/60 min-w-0">
                <div class="flex items-center justify-between gap-2 min-w-0">
                  <p class="font-semibold min-w-0 break-words">{point.label}</p>
                  <span class={`text-xs ${classesForPoint(point)}`}>
                    {point.emoji ? `${point.emoji} ` : ''}{point.element || ''}
                  </span>
                </div>
                <p class="text-lg font-display">{point.sign} {point.degree}</p>
                <p class="text-xs text-slate-400">
                  {point.quality || '—'} • {point.decan ? `Decan ${point.decan}` : 'No decan data'}
                </p>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-slate-400">Generate a chart to see the summary.</p>
  {/if}
</div>
