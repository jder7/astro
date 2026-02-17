<script>
  export let id = 'adv-aspects-config';
  export let maxOrb = 3;
  export let orbLimit = 3;
  export let showMajorAspects = true;
  export let movementFilter = 'both';
  export let hideAscendantAspects = false;
  export let showMatrices = true;
</script>

<div id={id} class="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-3 text-sm text-slate-300">
  <p class="text-xs uppercase tracking-widest text-slate-400">Configuration</p>
  <div class="flex flex-wrap items-center gap-3">
    <span class="text-xs uppercase tracking-widest text-slate-400">Max orb</span>
    <input
      type="range"
      min="0"
      max="10"
      step="0.1"
      class="w-36 accent-cyan-400"
      bind:value={maxOrb}
    />
    <span class="tabular-nums text-slate-200">{Number.isFinite(orbLimit) ? orbLimit.toFixed(1) : '—'}°</span>
  </div>
  <div class="grid gap-3 md:grid-cols-2">
    <label class="flex items-center gap-2">
      <input type="checkbox" class="accent-cyan-400" bind:checked={showMajorAspects} />
      <span>Show major aspects</span>
    </label>
    <label class="flex items-center gap-2">
      <input type="checkbox" class="accent-cyan-400" bind:checked={showMatrices} />
      <span>Show matrices</span>
    </label>
    <label class="flex items-center gap-2">
      <input type="checkbox" class="accent-cyan-400" bind:checked={hideAscendantAspects} />
      <span>Hide ascendant aspects</span>
    </label>
    <label class="flex items-center gap-2">
      <span>Movement</span>
      <select class="rounded-md bg-slate-900/80 border border-slate-800 text-slate-200 px-2 py-1" bind:value={movementFilter}>
        <option value="both">Applying &amp; separating</option>
        <option value="applying">Applying only</option>
        <option value="separating">Separating only</option>
      </select>
    </label>
  </div>
</div>
