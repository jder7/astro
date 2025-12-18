<script>
  import { extractAspects } from '$lib/astro/advanced';

  export let response = null;
  export let mode = 'natal';

  const formatPattern = (pattern) => {
    if (!pattern) return '';
    const name = pattern.name || pattern.id || pattern.geometry || 'Pattern';
    const points = Array.isArray(pattern.points) ? pattern.points.join(', ') : '';
    const desc = pattern.geometry || pattern.aspects_label || pattern.aspectsLabel || pattern.planets || '';
    return [name, points, desc].filter(Boolean).join(' — ');
  };

  $: aspectData = extractAspects(response || {});
  $: aspects = aspectData.aspects || [];
  $: natalAspects = aspectData.natalAspects || [];
  $: majorAspects = aspectData.majorAspects || [];
  $: natalMajorAspects = aspectData.natalMajorAspects || [];
</script>

<div class="flowbite-card space-y-4">
  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Synthesis</p>
      <h2>Aspects Summary</h2>
    </div>
    {#if response}
      <span class="badge capitalize">{mode}</span>
    {/if}
  </div>

  <div id="summaryContent" class="space-y-4">
    {#if !response}
      <p class="text-sm text-slate-400">Generate any mode to view aspects and configurations.</p>
    {:else}
      <div class="space-y-4">
        <div class="compact-row">
          <p class="compact-label">Aspects</p>
          <span class="badge">{aspects.length + natalAspects.length}</span>
        </div>
        {#if aspects.length}
          <ul class="space-y-2">
            {#each aspects as aspect}
              <li class="border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between">
                <div>
                  <p class="font-semibold">{aspect.name}</p>
                  <p class="text-xs text-slate-400">{aspect.left || '…'} ↔ {aspect.right || '…'}</p>
                </div>
                {#if aspect.orb}
                  <span class="badge">{aspect.orb}°</span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
        {#if natalAspects.length}
          <div class="space-y-2">
            <p class="text-xs text-slate-400">Natal</p>
            <ul class="space-y-2">
              {#each natalAspects as aspect}
                <li class="border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between">
                  <div>
                    <p class="font-semibold">{aspect.name}</p>
                    <p class="text-xs text-slate-400">{aspect.left || '…'} ↔ {aspect.right || '…'}</p>
                  </div>
                  {#if aspect.orb}
                    <span class="badge">{aspect.orb}°</span>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if !aspects.length && !natalAspects.length}
          <p class="text-sm text-slate-400">No aspects found for the current active points.</p>
        {/if}

        <div class="space-y-2">
          <div class="compact-row">
            <p class="compact-label">Major configurations</p>
            <span class="badge">{majorAspects.length + natalMajorAspects.length}</span>
          </div>
          {#if majorAspects.length}
            <div class="space-y-1">
              <p class="text-xs text-slate-400">Current chart</p>
              <ul class="list-disc list-inside text-sm text-slate-200">
                {#each majorAspects as pattern}
                  <li>{formatPattern(pattern)}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if natalMajorAspects.length}
            <div class="space-y-1">
              <p class="text-xs text-slate-400">Natal</p>
              <ul class="list-disc list-inside text-sm text-slate-200">
                {#each natalMajorAspects as pattern}
                  <li>{formatPattern(pattern)}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if !majorAspects.length && !natalMajorAspects.length}
            <p class="text-sm text-slate-400">No pattern matches returned.</p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
