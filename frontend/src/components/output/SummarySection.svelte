<script>
  import { classesForPoint } from '$lib/astro/summary';

  export let section;
</script>

<div class="glass-card p-4 space-y-3" id={`summary-section-${(section?.meta?.title || 'section').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
  <div class="flex items-center justify-between flex-wrap gap-2">
    <div>
      <p class="section-title text-xs">{section.meta?.title}</p>
      <p class="text-sm text-slate-300">
        {[section.meta?.datetime, section.meta?.tz].filter(Boolean).join(' • ') || '—'}
      </p>
      {#if section.meta?.location}
        <p class="text-xs text-slate-400">{section.meta.location}</p>
      {/if}
    </div>
    <span class="badge">{section.points?.length || 0} points</span>
  </div>

  <div class="grid sm:grid-cols-2 gap-3">
    {#each section.points || [] as point}
      <div class="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
        <div class="flex items-center justify-between">
          <p class="font-semibold">{point.label}</p>
          <span class={`text-xs ${classesForPoint(point)}`}>
            {point.emoji ? `${point.emoji} ` : ''}{point.element || ''}
          </span>
        </div>
        <p class="text-lg font-display">{point.sign} {point.degree}</p>
        <p class="text-xs text-slate-400">{point.quality || '—'} • {point.decan ? `Decan ${point.decan}` : 'No decan data'}</p>
      </div>
    {/each}
  </div>
</div>
