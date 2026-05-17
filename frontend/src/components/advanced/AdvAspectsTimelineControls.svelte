<script>
  import { onDestroy, onMount } from 'svelte';
  import { RANGE_PRESETS } from '$lib/astro/timeline/spans';

  export let activePreset = '1M';
  export let focusFilter = 'all';
  export let selectedAspectTypes = [];
  export let aspectTypes = [];
  export let selectedPoints = [];
  export let pointOptions = [];
  export let searchFilter = '';
  export let movementFilter = 'both';
  export let groupBy = 'speed';
  export let loading = false;
  export let spanCount = 0;
  export let requestTimeMs = NaN;
  export let requestReferenceTs = NaN;
  export let spanEngine = 'kinematic';
  export let instanceId = 'main';

  export let onPresetChange = () => {};
  export let onEngineChange = () => {};
  export let onFilterChange = () => {};

  let showAdvanced = false;
  let aspectMenuOpen = false;
  let pointMenuOpen = false;
  let controlsEl;

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
  const defaultFilters = {
    focusFilter: 'all',
    selectedAspectTypes: [],
    selectedPoints: [],
    searchFilter: '',
    movementFilter: 'both',
    groupBy: 'planet',
  };
  const aspectLabel = (value) =>
    String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  const pointLabel = (value) =>
    String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  const selectedCountLabel = (count, total, singular) => {
    if (!count) return `All ${singular}`;
    if (count === total) return `All ${singular}`;
    return `${count} ${singular}`;
  };
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
    closeMenus();
    activePreset = key;
    onPresetChange(key);
  };

  const handleEngine = (event) => {
    closeMenus();
    spanEngine = event?.target?.value || 'scan';
    onEngineChange(spanEngine);
  };

  const closeMenus = () => {
    aspectMenuOpen = false;
    pointMenuOpen = false;
  };

  const toggleAspectMenu = () => {
    pointMenuOpen = false;
    aspectMenuOpen = !aspectMenuOpen;
  };

  const togglePointMenu = () => {
    aspectMenuOpen = false;
    pointMenuOpen = !pointMenuOpen;
  };

  const handleDocumentPointerDown = (event) => {
    if (!controlsEl || controlsEl.contains(event.target)) return;
    closeMenus();
  };

  const handleDocumentFocusIn = (event) => {
    if (!controlsEl || controlsEl.contains(event.target)) return;
    closeMenus();
  };

  onMount(() => {
    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    document.addEventListener('focusin', handleDocumentFocusIn, true);
  });

  onDestroy(() => {
    document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    document.removeEventListener('focusin', handleDocumentFocusIn, true);
  });

  const toggleListValue = (list, value) => {
    const current = Array.isArray(list) ? list : [];
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  };

  const toggleAspect = (value) => {
    selectedAspectTypes = toggleListValue(selectedAspectTypes, value);
    emitFilterChange();
  };

  const togglePoint = (value) => {
    selectedPoints = toggleListValue(selectedPoints, value);
    emitFilterChange();
  };

  const clearAspects = () => {
    selectedAspectTypes = [];
    aspectMenuOpen = false;
    emitFilterChange();
  };

  const clearPoints = () => {
    selectedPoints = [];
    pointMenuOpen = false;
    emitFilterChange();
  };

  const emitFilterChange = () => {
    onFilterChange({ focusFilter, selectedAspectTypes, selectedPoints, searchFilter, movementFilter, groupBy });
  };

  const hasActiveFilters = () =>
    focusFilter !== defaultFilters.focusFilter ||
    selectedAspectTypes.length > 0 ||
    selectedPoints.length > 0 ||
    searchFilter.trim().length > 0 ||
    movementFilter !== defaultFilters.movementFilter ||
    groupBy !== defaultFilters.groupBy;

  const resetFilters = () => {
    closeMenus();
    if (!hasActiveFilters()) return;
    const ok = typeof window === 'undefined' || window.confirm('Reset all timeline filters?');
    if (!ok) return;
    focusFilter = defaultFilters.focusFilter;
    selectedAspectTypes = [];
    selectedPoints = [];
    searchFilter = defaultFilters.searchFilter;
    movementFilter = defaultFilters.movementFilter;
    groupBy = defaultFilters.groupBy;
    emitFilterChange();
  };

  const setFocus = (value) => {
    closeMenus();
    focusFilter = value;
    emitFilterChange();
  };
</script>

<div class="timeline-controls" bind:this={controlsEl}>
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

    <div class="multiselect-control aspect-filter-control">
      <span class="control-label">Aspect</span>
      <div class="multiselect">
        <button
          id={fieldId('aspect-filter')}
          type="button"
          class="multiselect-trigger timeline-aspect-filter"
          aria-haspopup="listbox"
          aria-expanded={aspectMenuOpen}
          on:click={toggleAspectMenu}
        >
          {selectedCountLabel(selectedAspectTypes.length, aspectTypes.length, 'aspects')}
        </button>
        {#if aspectMenuOpen}
          <div class="multiselect-menu" role="listbox" aria-label="Aspect type filter">
            <button type="button" class="multiselect-clear" on:click={clearAspects}>All aspects</button>
            {#each aspectTypes as aspect}
              <label class="multiselect-option">
                <input
                  type="checkbox"
                  checked={selectedAspectTypes.includes(aspect)}
                  on:change={() => toggleAspect(aspect)}
                />
                <span>{aspectLabel(aspect)}</span>
              </label>
            {/each}
          </div>
        {/if}
      </div>
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
        on:input={() => {
          closeMenus();
          emitFilterChange();
        }}
        class="search-input"
        aria-label="Filter by planet or aspect type"
      />
    </div>

    <button
      type="button"
      class="toggle-advanced"
      on:click={() => {
        closeMenus();
        showAdvanced = !showAdvanced;
      }}
      aria-expanded={showAdvanced}
    >
      {showAdvanced ? '▾' : '▸'} Advanced
    </button>

    <button
      type="button"
      class="reset-filters-btn"
      on:click={resetFilters}
      disabled={!hasActiveFilters()}
      title="Reset timeline filters"
      aria-label="Reset timeline filters"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 5a7 7 0 1 1-6.32 4H3.5A9 9 0 1 0 12 3v2Zm-7.5-.5V10h5.5L7.9 7.9A6.98 6.98 0 0 1 12 5V3a8.96 8.96 0 0 0-5.52 1.9L4.5 2.92V4.5Z" fill="currentColor" />
      </svg>
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
              on:click={() => setFocus(opt.value)}
              aria-pressed={focusFilter === opt.value}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
      <div class="control-group">
        <label for={fieldId('group-by')} class="control-label">Group</label>
        <select id={fieldId('group-by')} name={fieldId('group-by')} bind:value={groupBy} on:change={() => {
          closeMenus();
          emitFilterChange();
        }} class="control-select">
          {#each groupOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <div class="control-group">
        <label for={fieldId('movement-filter')} class="control-label">Movement</label>
        <select id={fieldId('movement-filter')} name={fieldId('movement-filter')} bind:value={movementFilter} on:change={() => {
          closeMenus();
          emitFilterChange();
        }} class="control-select">
          {#each movementOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <div class="multiselect-control point-filter-control">
        <span class="control-label">Points</span>
        <div class="multiselect">
          <button
            id={fieldId('point-filter')}
            type="button"
            class="multiselect-trigger timeline-point-filter"
            aria-haspopup="listbox"
            aria-expanded={pointMenuOpen}
            on:click={togglePointMenu}
          >
            {selectedCountLabel(selectedPoints.length, pointOptions.length, 'points')}
          </button>
          {#if pointMenuOpen}
            <div class="multiselect-menu" role="listbox" aria-label="Point filter">
              <button type="button" class="multiselect-clear" on:click={clearPoints}>All points</button>
              {#each pointOptions as point}
                <label class="multiselect-option">
                  <input
                    type="checkbox"
                    checked={selectedPoints.includes(point)}
                    on:change={() => togglePoint(point)}
                  />
                  <span>{pointLabel(point)}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if spanCount > 0 || loading || Number.isFinite(Number(requestTimeMs)) || Number.isFinite(Number(requestReferenceTs))}
    <div class="controls-status">
      {#if spanCount > 0}
        <span class="status-badge">{spanCount} spans</span>
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
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 18%, #1e293b 82%);
  }
  .preset-btn, .focus-btn {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 18%, rgba(15, 23, 42, 0.7));
    color: color-mix(in srgb, var(--accent, #06b6d4) 14%, #cbd5e1 86%);
    border: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .preset-btn:not(:last-child), .focus-btn:not(:last-child) {
    border-right: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 14%, #1e293b 86%);
  }
  .preset-btn:hover:not(:disabled), .focus-btn:hover {
    background: var(--accent-soft, rgba(14, 165, 233, 0.12));
    color: #f8fafc;
  }
  .preset-btn.active, .focus-btn.active {
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 82%, rgba(15, 23, 42, 0.5));
    color: color-mix(in srgb, var(--accent, #06b6d4) 52%, #f8fafc 48%);
  }
  .preset-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .aspect-filter-control {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .multiselect-control {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .multiselect {
    position: relative;
  }
  .multiselect-trigger {
    min-width: 118px;
    height: 28px;
    padding: 4px 26px 4px 8px;
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 16%, #1e293b 84%);
    background:
      linear-gradient(45deg, transparent 50%, #94a3b8 50%) right 10px center / 5px 5px no-repeat,
      linear-gradient(135deg, #94a3b8 50%, transparent 50%) right 6px center / 5px 5px no-repeat,
      color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 18%, rgba(15, 23, 42, 0.7));
    color: #e2e8f0;
    font-size: 11px;
    text-align: left;
  }
  .multiselect-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 20;
    width: 190px;
    max-height: 230px;
    overflow: auto;
    padding: 6px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 20%, #1e293b 80%);
    background: rgba(15, 23, 42, 0.98);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
  }
  .multiselect-clear {
    width: 100%;
    padding: 5px 7px;
    border: 0;
    border-radius: 6px;
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 42%, transparent);
    color: color-mix(in srgb, var(--accent, #06b6d4) 35%, #e2e8f0 65%);
    font-size: 11px;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }
  .multiselect-option {
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 28px;
    padding: 4px 7px;
    border-radius: 6px;
    color: #cbd5e1;
    font-size: 11px;
    text-transform: none;
    letter-spacing: 0;
    cursor: pointer;
  }
  .multiselect-option:hover {
    background: rgba(148, 163, 184, 0.08);
  }
  .multiselect-option input {
    width: 14px;
    height: 14px;
    accent-color: var(--accent, #06b6d4);
  }
  .engine-control {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .search-input {
    padding: 5px 10px;
    font-size: 11px;
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 18%, rgba(15, 23, 42, 0.7));
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 16%, #1e293b 84%);
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
    color: color-mix(in srgb, var(--accent, #06b6d4) 14%, #94a3b8 86%);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s;
  }
  .toggle-advanced:hover { color: color-mix(in srgb, var(--accent, #06b6d4) 32%, #e2e8f0 68%); }
  .reset-filters-btn {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 20%, #1e293b 80%);
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 16%, rgba(15, 23, 42, 0.7));
    color: color-mix(in srgb, var(--accent, #06b6d4) 24%, #cbd5e1 76%);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s, opacity 0.15s;
  }
  .reset-filters-btn:hover:not(:disabled) {
    color: #f8fafc;
    border-color: color-mix(in srgb, var(--accent, #06b6d4) 48%, #334155 52%);
    background: var(--accent-soft, rgba(14, 165, 233, 0.12));
  }
  .reset-filters-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .reset-filters-btn svg {
    width: 14px;
    height: 14px;
  }
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
    color: color-mix(in srgb, var(--accent, #06b6d4) 14%, #94a3b8 86%);
    font-weight: 600;
  }
  .control-select {
    font-size: 11px;
    padding: 4px 8px;
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 18%, rgba(15, 23, 42, 0.7));
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 16%, #1e293b 84%);
    border-radius: 6px;
    color: #e2e8f0;
  }
  .controls-status {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .status-badge {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 9999px;
    background: var(--accent-soft, rgba(14, 165, 233, 0.12));
    color: color-mix(in srgb, var(--accent, #06b6d4) 52%, #f8fafc 48%);
    font-weight: 600;
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
