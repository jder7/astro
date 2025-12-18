<script>
  import { get } from 'svelte/store';
  import MajorAspectIcon from '$components/shared/MajorAspectIcon.svelte';
  import { extractAspects } from '$lib/astro/advanced';
  import { configStore } from '$lib/state/configStore';

  export let response = null;
  export let mode = 'natal';

  const normalizeLabel = (label) => String(label || '').trim().replace(/\s+/g, '_').toLowerCase();

  const formatPatternParts = (pattern) => {
    if (!pattern) return { name: 'Pattern', detail: '' };
    const name = pattern.name || pattern.id || pattern.geometry || 'Pattern';
    const points = Array.isArray(pattern.points) ? pattern.points.join(', ') : '';
    const desc = pattern.geometry || pattern.aspects_label || pattern.aspectsLabel || pattern.planets || '';
    return { name, detail: [points, desc].filter(Boolean).join(' · ') };
  };

  $: aspectData = extractAspects(response || {});
  $: aspects = aspectData.aspects || [];
  $: natalAspects = aspectData.natalAspects || [];
  $: majorAspects = aspectData.majorAspects || [];
  $: natalMajorAspects = aspectData.natalMajorAspects || [];
  $: activeSet = new Set((get(configStore).active_points || []).map((point) => normalizeLabel(point)));

  const filterAspectsByActive = (entries) =>
    (entries || []).filter((aspect) => {
      if (!aspect || !activeSet.size) return Boolean(aspect);
      const leftKey = normalizeLabel(aspect.left);
      const rightKey = normalizeLabel(aspect.right);
      if (!leftKey || !rightKey) return false;
      return activeSet.has(leftKey) && activeSet.has(rightKey);
    });

  $: filteredAspects = filterAspectsByActive(aspects);
  $: filteredNatalAspects = filterAspectsByActive(natalAspects);
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

  <div id="adv-aspects-panel" class="space-y-4">
    {#if !response}
      <p class="text-sm text-slate-400">Generate any mode to view aspects and configurations.</p>
    {:else}
      <div class="space-y-4">
        <div id="adv-aspects-major-configs" class="space-y-2">
          <div class="compact-row">
            <p class="compact-label">Major configurations</p>
            <span class="badge">{majorAspects.length + natalMajorAspects.length}</span>
          </div>
          {#if majorAspects.length}
            <div class="space-y-1">
              <p class="text-xs text-slate-400">Current chart</p>
              <ul id="adv-aspects-major-current" class="space-y-2 text-sm text-slate-200">
                {#each majorAspects as pattern}
                  {@const parts = formatPatternParts(pattern)}
                  <li class="flex items-start gap-2">
                    <MajorAspectIcon patternId={pattern.id || 'generic'} size={24} />
                    <div>
                      <p class="text-sm text-slate-200">{parts.name}</p>
                      {#if parts.detail}
                        <p class="text-xs text-slate-400">{parts.detail}</p>
                      {/if}
                    </div>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if natalMajorAspects.length}
            <div class="space-y-1">
              <p class="text-xs text-slate-400">Natal</p>
              <ul id="adv-aspects-major-natal" class="space-y-2 text-sm text-slate-200">
                {#each natalMajorAspects as pattern}
                  {@const parts = formatPatternParts(pattern)}
                  <li class="flex items-start gap-2">
                    <MajorAspectIcon patternId={pattern.id || 'generic'} size={24} />
                    <div>
                      <p class="text-sm text-slate-200">{parts.name}</p>
                      {#if parts.detail}
                        <p class="text-xs text-slate-400">{parts.detail}</p>
                      {/if}
                    </div>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if !majorAspects.length && !natalMajorAspects.length}
            <p class="text-sm text-slate-400">No pattern matches returned.</p>
          {/if}
        </div>

        <div class="compact-row">
          <p class="compact-label">Aspects</p>
          <span class="badge">{filteredAspects.length + filteredNatalAspects.length}</span>
        </div>
        {#if filteredAspects.length}
          <ul class="space-y-2">
            {#each filteredAspects as aspect}
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
        {#if filteredNatalAspects.length}
          <div class="space-y-2">
            <p class="text-xs text-slate-400">Natal</p>
            <ul class="space-y-2">
              {#each filteredNatalAspects as aspect}
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
        {#if !filteredAspects.length && !filteredNatalAspects.length}
          <p class="text-sm text-slate-400">No aspects found for the current active points.</p>
        {/if}
      </div>
    {/if}
  </div>
</div>
