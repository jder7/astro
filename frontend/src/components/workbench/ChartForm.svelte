<script>
  import { createEventDispatcher } from 'svelte';
  import SubjectFields from '../forms/SubjectFields.svelte';
  import ConfigPanel from './ConfigPanel.svelte';
  import { inputStore, resetInputs, setMode, updateBirth, updateRelationship, updateTransit } from '$lib/state/inputStore';

  const dispatch = createEventDispatcher();
  const modes = [
    { key: 'natal', label: 'Natal', icon: '👤' },
    { key: 'transit', label: 'Transit', icon: '🕒' },
    { key: 'natal_transit', label: 'Dual', icon: '🌀' },
    { key: 'relationship', label: 'Synastry', icon: '👥' },
  ];

  const pad = (v) => String(v ?? 0).padStart(2, '0');
  const toDate = (obj) =>
    obj && [obj.year, obj.month, obj.day].every((n) => Number.isFinite(Number(n)))
      ? `${obj.year}-${pad(obj.month)}-${pad(obj.day)}`
      : '';
  const toTime = (obj) =>
    obj && Number.isFinite(Number(obj.hour)) && Number.isFinite(Number(obj.minute))
      ? `${pad(obj.hour)}:${pad(obj.minute)}`
      : '';

  $: state = $inputStore;
  $: birthValue = { ...state.birth, date: toDate(state.birth), time: toTime(state.birth) };
  $: transitValue = { ...state.transit, date: toDate(state.transit), time: toTime(state.transit) };
  $: firstValue = { ...state.relationship.first, date: toDate(state.relationship.first), time: toTime(state.relationship.first) };
  $: secondValue = { ...state.relationship.second, date: toDate(state.relationship.second), time: toTime(state.relationship.second) };
  let showConfig = false;

  function confirmReset() {
    if (window.confirm('Reset inputs? This will clear all fields.')) {
      resetInputs();
    }
  }

  function submit(event) {
    event.preventDefault();
    dispatch('submit', { mode: state.mode });
  }
</script>

<form class="space-y-5" on:submit|preventDefault={submit} id="chart-form">
  <div class="glass-card p-4 space-y-4" id="mode-panel">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="icon-button"
          aria-label="Toggle configuration"
          title="Toggle configuration"
          on:click={() => (showConfig = !showConfig)}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.757.426 1.757 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.757-2.924 1.757-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.757-.426-1.757-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"
            />
            <circle cx="12" cy="12" r="2.75" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-button"
          aria-label="Reset inputs"
          title="Reset inputs"
          on:click={confirmReset}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4h16M10 11v6m4-6v6M6 7h12l-1 13H7L6 7Z" />
          </svg>
        </button>
      </div>
      <div class="flex items-center gap-2 mode-legend">
        <span class="legend-dot" aria-hidden="true"></span>
        <p class="text-xs text-slate-400">
          <span class="badge">{modes.find((m) => m.key === state.mode)?.label}</span>
        </p>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-2 mode-grid">
      {#each modes as mode}
        <button
          type="button"
          class={`mode-pill ${state.mode === mode.key ? 'active' : ''}`}
          on:click={() => setMode(mode.key)}
          aria-label={mode.label}
          aria-pressed={state.mode === mode.key}
        >
          <span class="mode-icon" aria-hidden="true">{mode.icon}</span>
          {#if state.mode === mode.key}
            <span class="legend-dot bright" aria-hidden="true"></span>
          {/if}
          <span class="sr-only">{mode.label}</span>
        </button>
      {/each}
    </div>

    {#if showConfig}
      <div class="slide-panel">
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs text-slate-400">Chart configuration</p>
          <button
            type="button"
            class="icon-button"
            aria-label="Close configuration"
            title="Close configuration"
            on:click={() => (showConfig = false)}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <ConfigPanel />
      </div>
    {/if}
  </div>

  {#if state.mode === 'natal' || state.mode === 'natal_transit'}
    <section id="birth-fields">
      <SubjectFields
        variant="natal"
        label="Birth"
        tag="Natal"
        value={birthValue}
        idPrefix="birth"
        onChange={updateBirth}
      />
    </section>
  {/if}

  {#if state.mode === 'transit' || state.mode === 'natal_transit'}
    <section id="transit-fields">
      <SubjectFields
        variant="transit"
        label={state.mode === 'transit' ? 'Transit' : 'Transit overlay'}
        tag="Transit"
        value={transitValue}
        idPrefix="transit"
        onChange={updateTransit}
      />
    </section>
  {/if}

  {#if state.mode === 'relationship'}
    <div class="space-y-4" id="relationship-fields">
      <SubjectFields
        variant="partner"
        label="Partner A"
        tag="Synastry"
        value={firstValue}
        idPrefix="partner-a"
        onChange={(patch) => updateRelationship('first', patch)}
      />
      <SubjectFields
        variant="partner"
        label="Partner B"
        tag="Synastry"
        value={secondValue}
        idPrefix="partner-b"
        onChange={(patch) => updateRelationship('second', patch)}
      />
    </div>
  {/if}

  <div class="flex items-center gap-3">
    <button type="submit" class="button-primary">Generate chart</button>
  </div>
</form>
