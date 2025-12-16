<script>
  import { configStore, resetConfig, updateConfig } from '$lib/state/configStore';
  import { ACTIVE_POINTS } from '$lib/astro/points';

  const perspectiveOptions = ['Topocentric', 'Apparent Geocentric', 'True Geocentric', 'Heliocentric'];
  const zodiacOptions = ['Sidereal', 'Tropic'];
  const siderealModes = ['KRISHNAMURTI', 'LAHIRI'];
  const houseSystems = [
    { value: 'W', label: 'Whole sign (W)' },
    { value: 'P', label: 'Placidus (P)' },
    { value: 'K', label: 'Koch (K)' },
    { value: 'R', label: 'Regiomontanus (R)' },
  ];
  const themes = ['dark', 'classic', 'dark-high-contrast', 'light', 'strawberry', 'black-and-white'];
  const aspectPoints = ACTIVE_POINTS;

  $: config = $configStore;

  const toggleActivePoint = (key) => {
    const current = new Set(config.active_points || []);
    if (current.has(key)) current.delete(key);
    else current.add(key);
    updateConfig({ active_points: Array.from(current) });
  };
</script>

<div class="glass-card p-4 space-y-3" id="config-panel">
  <div class="flex items-center justify-between">
    <div>
      <p class="section-title text-xs">Chart config</p>
      <p class="text-xs text-slate-400">Shared across pages.</p>
    </div>
    <button class="button-ghost text-xs" type="button" on:click={resetConfig}>Reset</button>
  </div>

  <div class="micro-grid text-xs sm:text-sm" id="config-layout">
    <div class="space-y-1">
      <label class="micro-label">Perspective</label>
      <select class="flowbite-input flowbite-select" value={config.perspective} on:change={(e) => updateConfig({ perspective: e.target.value })}>
        {#each perspectiveOptions as option}
          <option value={option} selected={option === config.perspective}>{option}</option>
        {/each}
      </select>
    </div>
    <div class="space-y-1">
      <label class="micro-label">Zodiac</label>
      <select class="flowbite-input flowbite-select" value={config.zodiac_type} on:change={(e) => updateConfig({ zodiac_type: e.target.value })}>
        {#each zodiacOptions as option}
          <option value={option} selected={option === config.zodiac_type}>{option}</option>
        {/each}
      </select>
    </div>
    {#if config.zodiac_type === 'Sidereal'}
      <div class="space-y-1">
        <label class="micro-label">Sidereal</label>
        <select class="flowbite-input flowbite-select" value={config.sidereal_mode} on:change={(e) => updateConfig({ sidereal_mode: e.target.value })}>
          {#each siderealModes as option}
            <option value={option} selected={option === config.sidereal_mode}>{option}</option>
          {/each}
        </select>
      </div>
    {/if}
    <div class="space-y-1">
      <label class="micro-label">Houses</label>
      <select class="flowbite-input flowbite-select" value={config.house_system} on:change={(e) => updateConfig({ house_system: e.target.value })}>
        {#each houseSystems as option}
          <option value={option.value} selected={option.value === config.house_system}>{option.label}</option>
        {/each}
      </select>
    </div>
    <div class="space-y-1">
      <label class="micro-label">Theme</label>
      <select class="flowbite-input flowbite-select" value={config.theme} on:change={(e) => updateConfig({ theme: e.target.value })}>
        {#each themes as option}
          <option value={option} selected={option === config.theme}>{option}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="space-y-1" id="config-aspect-points">
    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Aspect base points</p>
    <div class="grid grid-cols-2 gap-1 text-[11px]">
      {#each aspectPoints as point}
        <label class="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-lg px-2.5 py-1.5 truncate" title={point.label}>
          <input
            type="checkbox"
            class="rounded border-slate-700"
            checked={(config.active_points || []).includes(point.key)}
            on:change={() => toggleActivePoint(point.key)}
          />
          <span class="truncate" title={point.label}>{point.emoji ? `${point.emoji} ` : ''}{point.label}</span>
        </label>
      {/each}
    </div>
  </div>
</div>
