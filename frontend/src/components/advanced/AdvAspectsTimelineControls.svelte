<script>
  import { RANGE_PRESETS } from '$lib/astro/timeline/spans';

  export let activePreset = '1M';
  export let focusFilter = 'all';
  export let aspectFilter = 'all';
  export let aspectTypes = [];
  export let orbLimit = 3;
  export let searchFilter = '';
  export let movementFilter = 'both';
  export let groupBy = 'speed';
  export let hideVeryFast = false;
  export let loading = false;
  export let spanCount = 0;
  export let hiddenCount = 0;
  export let requestTimeMs = NaN;
  export let requestReferenceTs = NaN;
  export let spanEngine = 'kinematic';
  export let instanceId = 'main';

  export let onPresetChange = () => {};
  export let onEngineChange = () => {};
  export let onFilterChange = () => {};

  let showAdvanced = false;

  const presetKeys = Object.keys(RANGE_PRESETS);
  const focusOptions = [
    { value: 'all', label: 'All' },
    { value: 'very_fast', label: '≤1d' },
    { value: 'fast', label: '1d–1w' },
    { value: 'normal', label: '1w–1mo' },
    { value: 'slow', label: '1mo–1y' },
    { value: 'very_slow', label: '>1y' },
  ];
  const groupOptions = [
    { value: 'speed', label: 'Duration' },
    { value: 'aspectType', label: 'Aspect type' },
    { value: 'planet', label: 'Planet' },
  ];
  const movementOptions = [
    { value: 'both', label: 'Both' },
    { value: 'applying', label: 'Applying' },
    { value: 'separating', label: 'Separating' },
  ];
  const engineOptions = [
    { value: 'scan', label: 'Exact scan' },
    { value: 'kinematic', label: 'Kinematic' },
  ];
  const aspectLabel = (value) =>
    String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  const formatRequestTime = (ms) => {
    const value = Number(ms);
    if (!Number.isFinite(value)) return '';
    if (value < 1000) return `${Math.round(value)} ms`;
    if (value < 10_000) return `${(value / 1000).toFixed(2)} s`;
    return `${(value / 1000).toFixed(1)} s`;
  };
  const formatReferenceTime = (ms) => {
    const value = Number(ms);
    if (!Number.isFinite(value)) return '';
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };
  const fieldId = (name) => `advanced-aspects-timeline-${instanceId}-${name}`;

  const handlePreset = (key) => {
    activePreset = key;
    onPresetChange(key);
  };

  const handleEngine = (event) => {
    spanEngine = event?.target?.value || 'scan';
    onEngineChange(spanEngine);
  };

  const emitFilterChange = () => {
    onFilterChange({ focusFilter, aspectFilter, orbLimit, searchFilter, movementFilter, groupBy, hideVeryFast });
  };

  $: orbLimit, focusFilter, aspectFilter, searchFilter, movementFilter, groupBy, hideVeryFast, emitFilterChange();
</script>

<div class="timeline-controls">
  <div class="controls-row">
    <div class="preset-group" role="group" aria-label="Time range presets">
      {#each presetKeys as key}
        <button
          type="button"
          class="preset-btn"
          class:active={activePreset === key}
          disabled={loading}
          on:click={() => handlePreset(key)}
          aria-pressed={activePreset === key}
        >
          {key}
        </button>
      {/each}
    </div>

    <div class="orb-control">
      <label for={fieldId('orb-slider')} class="orb-label">Orb ≤{orbLimit}°</label>
      <input
        id={fieldId('orb-slider')}
        name={fieldId('orb-slider')}
        type="range"
        min="0.5"
        max="10"
        step="0.5"
        bind:value={orbLimit}
        class="orb-slider"
      />
    </div>

    <div class="aspect-filter-control">
      <label for={fieldId('aspect-filter')} class="control-label">Aspect</label>
      <select id={fieldId('aspect-filter')} name={fieldId('aspect-filter')} bind:value={aspectFilter} class="control-select timeline-aspect-filter">
        <option value="all">All</option>
        {#each aspectTypes as aspect}
          <option value={aspect}>{aspectLabel(aspect)}</option>
        {/each}
      </select>
    </div>

    <div class="engine-control">
      <label for={fieldId('span-engine')} class="control-label">Engine</label>
      <select
        id={fieldId('span-engine')}
        name={fieldId('span-engine')}
        value={spanEngine}
        class="control-select timeline-span-engine"
        disabled={loading}
        on:change={handleEngine}
      >
        {#each engineOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>

    <div class="search-control">
      <input
        id={fieldId('search-filter')}
        name={fieldId('search-filter')}
        type="text"
        placeholder="Filter points…"
        bind:value={searchFilter}
        class="search-input"
        aria-label="Filter by planet or aspect type"
      />
    </div>

    <button
      type="button"
      class="toggle-advanced"
      on:click={() => (showAdvanced = !showAdvanced)}
      aria-expanded={showAdvanced}
    >
      {showAdvanced ? '▾' : '▸'} Advanced
    </button>
  </div>

  {#if showAdvanced}
    <div class="controls-row advanced-row">
      <div class="focus-control">
        <span class="control-label">Duration</span>
        <div class="focus-group" role="group" aria-label="Duration filter">
          {#each focusOptions as opt}
            <button
              type="button"
              class="focus-btn"
              class:active={focusFilter === opt.value}
              on:click={() => (focusFilter = opt.value)}
              aria-pressed={focusFilter === opt.value}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
      <div class="control-group">
        <label for={fieldId('group-by')} class="control-label">Group</label>
        <select id={fieldId('group-by')} name={fieldId('group-by')} bind:value={groupBy} class="control-select">
          {#each groupOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <div class="control-group">
        <label for={fieldId('movement-filter')} class="control-label">Movement</label>
        <select id={fieldId('movement-filter')} name={fieldId('movement-filter')} bind:value={movementFilter} class="control-select">
          {#each movementOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <label class="control-check">
        <input id={fieldId('hide-very-fast')} name={fieldId('hide-very-fast')} type="checkbox" bind:checked={hideVeryFast} />
        <span>Hide very fast aspects</span>
      </label>
    </div>
  {/if}

  {#if spanCount > 0 || hiddenCount > 0 || loading || Number.isFinite(Number(requestTimeMs)) || Number.isFinite(Number(requestReferenceTs))}
    <div class="controls-status">
      {#if spanCount > 0}
        <span class="status-badge">{spanCount} spans</span>
      {/if}
      {#if hiddenCount > 0}
        <span class="status-badge status-badge--button">
          {hiddenCount} hidden
        </span>
      {/if}
      {#if Number.isFinite(Number(requestTimeMs))}
        <span class="status-badge status-badge--request">
          Request {formatRequestTime(requestTimeMs)}
        </span>
      {/if}
      {#if Number.isFinite(Number(requestReferenceTs))}
        <span class="status-badge status-badge--reference">
          Ref {formatReferenceTime(requestReferenceTs)}
        </span>
      {/if}
      {#if loading}
        <span class="status-badge status-badge--loading">Loading…</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .timeline-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .controls-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .preset-group, .focus-group {
    display: inline-flex;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }
  .preset-btn, .focus-btn {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(15, 23, 42, 0.7);
    color: #94a3b8;
    border: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    letter-spacing: 0.04em;
  }
  .preset-btn:not(:last-child), .focus-btn:not(:last-child) {
    border-right: 1px solid rgba(148, 163, 184, 0.15);
  }
  .preset-btn:hover:not(:disabled), .focus-btn:hover {
    background: rgba(56, 189, 248, 0.12);
    color: #e2e8f0;
  }
  .preset-btn.active, .focus-btn.active {
    background: rgba(56, 189, 248, 0.2);
    color: #7dd3fc;
  }
  .preset-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .orb-control {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .aspect-filter-control {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .engine-control {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .orb-label {
    font-size: 11px;
    color: #94a3b8;
    white-space: nowrap;
    font-weight: 600;
  }
  .orb-slider {
    width: 80px;
    accent-color: #38bdf8;
    height: 4px;
  }
  .search-input {
    padding: 5px 10px;
    font-size: 11px;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 6px;
    color: #e2e8f0;
    width: 130px;
  }
  .search-input::placeholder {
    color: #475569;
  }
  .toggle-advanced {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s;
  }
  .toggle-advanced:hover { color: #94a3b8; }
  .advanced-row {
    padding: 8px 0 0;
    border-top: 1px solid rgba(148, 163, 184, 0.1);
  }
  .control-group, .focus-control {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .control-label {
    font-size: 11px;
    color: #64748b;
    font-weight: 600;
  }
  .control-select {
    font-size: 11px;
    padding: 4px 8px;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 6px;
    color: #e2e8f0;
  }
  .control-check {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #94a3b8;
    cursor: pointer;
  }
  .control-check input { accent-color: #38bdf8; }
  .controls-status {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .status-badge {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 9999px;
    background: rgba(56, 189, 248, 0.12);
    color: #7dd3fc;
    font-weight: 600;
  }
  .status-badge--button {
    border: 0;
    cursor: pointer;
    background: rgba(220, 38, 38, 0.15);
    color: #fca5a5;
  }
  .status-badge--button:hover {
    background: rgba(220, 38, 38, 0.24);
  }
  .status-badge--loading {
    background: rgba(250, 204, 21, 0.15);
    color: #fde68a;
  }
  .status-badge--request {
    background: rgba(148, 163, 184, 0.14);
    color: #cbd5e1;
  }
  .status-badge--reference {
    background: rgba(34, 197, 94, 0.12);
    color: #86efac;
  }
</style>
