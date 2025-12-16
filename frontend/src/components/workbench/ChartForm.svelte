<script>
  import { createEventDispatcher } from 'svelte';
  import BirthFields from '../forms/BirthFields.svelte';
  import TransitFields from '../forms/TransitFields.svelte';
  import PartnerFields from '../forms/PartnerFields.svelte';
  import { inputStore, resetInputs, setMode, updateBirth, updateRelationship, updateTransit } from '$lib/state/inputStore';

  const dispatch = createEventDispatcher();
  const modes = [
    { key: 'natal', label: 'Natal', description: 'Single chart' },
    { key: 'transit', label: 'Transit', description: 'Moment in time' },
    { key: 'natal_transit', label: 'Natal + Transit', description: 'Dual wheel' },
    { key: 'relationship', label: 'Relationship', description: 'Synastry' },
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

  function submit(event) {
    event.preventDefault();
    dispatch('submit', { mode: state.mode });
  }
</script>

<form class="space-y-6" on:submit|preventDefault={submit}>
  <div class="glass-card p-4 space-y-3">
    <div class="flex items-center justify-between">
      <div>
        <p class="section-title text-xs">Mode</p>
        <p class="text-sm text-slate-300">Choose how to generate the chart.</p>
      </div>
      <button class="button-ghost" type="button" on:click={resetInputs}>Reset inputs</button>
    </div>
    <div class="grid grid-cols-2 gap-3">
      {#each modes as mode}
        <button
          type="button"
          class={`glass-card p-3 text-left border ${state.mode === mode.key ? 'border-cyan-400/60 shadow-glow' : 'border-slate-800'} hover:border-cyan-400/60 transition`}
          on:click={() => setMode(mode.key)}
          aria-pressed={state.mode === mode.key}
        >
          <div class="flex items-center justify-between">
            <p class="font-semibold">{mode.label}</p>
            {#if state.mode === mode.key}
              <span class="badge">Active</span>
            {/if}
          </div>
          <p class="text-sm text-slate-400">{mode.description}</p>
        </button>
      {/each}
    </div>
  </div>

  {#if state.mode === 'natal' || state.mode === 'natal_transit'}
    <BirthFields value={birthValue} onChange={updateBirth} />
  {/if}

  {#if state.mode === 'transit' || state.mode === 'natal_transit'}
    <TransitFields value={transitValue} onChange={updateTransit} title={state.mode === 'transit' ? 'Transit' : 'Transit overlay'} />
  {/if}

  {#if state.mode === 'relationship'}
    <div class="grid sm:grid-cols-2 gap-4">
      <PartnerFields value={firstValue} label="Partner A" onChange={(patch) => updateRelationship('first', patch)} />
      <PartnerFields value={secondValue} label="Partner B" onChange={(patch) => updateRelationship('second', patch)} />
    </div>
  {/if}

  <div class="flex items-center gap-3">
    <button type="submit" class="button-primary">Generate chart</button>
    <p class="text-sm text-slate-400">Data persists in this browser.</p>
  </div>
</form>
