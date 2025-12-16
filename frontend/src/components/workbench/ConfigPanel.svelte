<script>
  import { configStore, resetConfig, updateConfig } from '$lib/state/configStore';

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
  const aspectPoints = [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'ascendant',
    'uranus',
    'neptune',
    'pluto',
    'mean_node',
    'true_node',
    'medium_coeli',
    'descendant',
    'imum_coeli',
  ];

  $: config = $configStore;

  const toggleActivePoint = (key) => {
    const current = new Set(config.active_points || []);
    if (current.has(key)) current.delete(key);
    else current.add(key);
    updateConfig({ active_points: Array.from(current) });
  };
</script>

<div class="glass-card p-5 space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <p class="section-title text-xs">Chart config</p>
      <p class="text-sm text-slate-300">Shared across the three pages.</p>
    </div>
    <button class="button-ghost" type="button" on:click={resetConfig}>Reset</button>
  </div>
  <div class="grid sm:grid-cols-2 gap-3 text-sm">
    <div class="space-y-1.5">
      <label>Perspective</label>
      <select value={config.perspective} on:change={(e) => updateConfig({ perspective: e.target.value })}>
        {#each perspectiveOptions as option}
          <option value={option} selected={option === config.perspective}>{option}</option>
        {/each}
      </select>
    </div>
    <div class="space-y-1.5">
      <label>Zodiac</label>
      <select value={config.zodiac_type} on:change={(e) => updateConfig({ zodiac_type: e.target.value })}>
        {#each zodiacOptions as option}
          <option value={option} selected={option === config.zodiac_type}>{option}</option>
        {/each}
      </select>
    </div>
    {#if config.zodiac_type === 'Sidereal'}
      <div class="space-y-1.5">
        <label>Sidereal mode</label>
        <select value={config.sidereal_mode} on:change={(e) => updateConfig({ sidereal_mode: e.target.value })}>
          {#each siderealModes as option}
            <option value={option} selected={option === config.sidereal_mode}>{option}</option>
          {/each}
        </select>
      </div>
    {/if}
    <div class="space-y-1.5">
      <label>House system</label>
      <select value={config.house_system} on:change={(e) => updateConfig({ house_system: e.target.value })}>
        {#each houseSystems as option}
          <option value={option.value} selected={option.value === config.house_system}>{option.label}</option>
        {/each}
      </select>
    </div>
    <div class="space-y-1.5">
      <label>Chart SVG theme</label>
      <select value={config.theme} on:change={(e) => updateConfig({ theme: e.target.value })}>
        {#each themes as option}
          <option value={option} selected={option === config.theme}>{option}</option>
        {/each}
      </select>
    </div>
    <div class="space-y-1.5">
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          class="rounded border-slate-700"
          checked={config.asc_moon_sun_range_enabled}
          on:change={(e) => updateConfig({ asc_moon_sun_range_enabled: e.target.checked })}
        />
        Include asc/moon/sun sweeps
      </label>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          class="rounded border-slate-700"
          checked={config.include_aspects}
          on:change={(e) => updateConfig({ include_aspects: e.target.checked })}
        />
        Include aspects in summaries
      </label>
    </div>
  </div>

  <div class="space-y-2">
    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Aspect base points</p>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
      {#each aspectPoints as point}
        <label class="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-2">
          <input
            type="checkbox"
            class="rounded border-slate-700"
            checked={(config.active_points || []).includes(point)}
            on:change={() => toggleActivePoint(point)}
          />
          <span class="capitalize">{point.replace('_', ' ')}</span>
        </label>
      {/each}
    </div>
  </div>
</div>
