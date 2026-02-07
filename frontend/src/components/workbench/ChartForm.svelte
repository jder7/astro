<script>
  import { createEventDispatcher, tick } from 'svelte';
  import SubjectFields from '../forms/SubjectFields.svelte';
  import ConfigPanel from './ConfigPanel.svelte';
  import { inputStore, resetInputs, setMode, updateBirth, updateRelationship, updateTransit } from '$lib/state/inputStore';
  import { animateCards } from '$lib/animations/pageTransitions';
  import { isMobileStore } from '$lib/state/mediaStore';
  import ConfigIcon from '$components/visual/ConfigIcon.svelte';

  const dispatch = createEventDispatcher();
  export let resultsReady = false;
  export let resultKey = 0;
  export let focusTargetId = '';
  export let loading = false;
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
  let isMobile = false;
  let inputsCollapsed = false;
  let lastResultKey = resultKey;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const smoothScrollTo = (targetY, duration = 1200) =>
    new Promise((resolve) => {
      const start = window.scrollY || window.pageYOffset || 0;
      const distance = targetY - start;
      const startTime = performance.now();
      const easeInOut = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOut(progress);
        window.scrollTo(0, start + distance * eased);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(step);
    });

  const scrollToStatusCard = async () => {
    if (!focusTargetId || typeof document === 'undefined' || typeof window === 'undefined') return;
    await tick();
    await sleep(500);
    const target = document.getElementById(focusTargetId);
    if (!target) return;
    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, Math.max(0, targetTop));
      return;
    }
    await smoothScrollTo(Math.max(0, targetTop), 1400);
  };

  const collapseInputs = async () => {
    if (!isMobile) return;
    inputsCollapsed = true;
    await scrollToStatusCard();
  };

  const revealInputs = () => {
    inputsCollapsed = false;
  };

  $: isMobile = $isMobileStore;
  $: if (!isMobile) {
    inputsCollapsed = false;
  }

  function confirmReset() {
    if (window.confirm('Reset inputs? This will clear all fields.')) {
      resetInputs();
    }
  }

  async function handleModeChange(nextMode) {
    setMode(nextMode);
    await tick();
    animateCards();
  }

  function submit(event) {
    event.preventDefault();
    dispatch('submit', { mode: state.mode });
  }

  $: if (resultKey !== lastResultKey) {
    lastResultKey = resultKey;
    if (resultsReady) {
      collapseInputs();
    }
  }

  $: if (!resultsReady) {
    inputsCollapsed = false;
  }
</script>

<div class="chart-form-shell min-w-0">
  <div class={`chart-form-body ${inputsCollapsed ? 'is-collapsed' : ''}`}>
    <form class="space-y-5 min-w-0" on:submit|preventDefault={submit} id="chart-form" aria-hidden={inputsCollapsed}>
      <div class="glass-card p-4 space-y-4 min-w-0" id="mode-panel">
        <div class="mode-panel-head">
          <div class="mode-panel-actions">
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
          <div class="mode-panel-legend">
            <span class="legend-dot" aria-hidden="true"></span>
            <p class="text-xs text-slate-400">
              <span class="badge">{modes.find((m) => m.key === state.mode)?.label}</span>
            </p>
          </div>
        </div>

        <div class="grid gap-2 mode-grid min-w-0">
          {#each modes as mode}
            <button
              type="button"
              class={`mode-pill ${state.mode === mode.key ? 'active' : ''}`}
              on:click={() => handleModeChange(mode.key)}
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
        <button type="submit" class="button-primary" disabled={loading}>Generate chart</button>
      </div>
    </form>
  </div>

  {#if isMobile && inputsCollapsed}
    <div class="chart-form-toggle">
      <button type="button" class="chart-form-reveal" on:click={revealInputs} aria-controls="chart-form">
        <ConfigIcon size={16} />
        <span>Show inputs</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .chart-form-shell {
    display: grid;
    gap: 0.75rem;
  }

  .chart-form-body {
    transition: opacity 160ms ease, transform 160ms ease, max-height 180ms ease;
    max-height: 2400px;
    opacity: 1;
    transform: translateY(0);
  }

  .chart-form-body.is-collapsed {
    max-height: 0;
    opacity: 0;
    transform: translateY(-6px);
    overflow: hidden;
    pointer-events: none;
  }

  .chart-form-toggle {
    display: flex;
    justify-content: flex-start;
  }

  .chart-form-reveal {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.85rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 35%, #1e293b 65%);
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 45%, rgba(15, 23, 42, 0.9));
    color: #e2e8f0;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    transition: all 150ms ease;
  }

  .chart-form-reveal:hover {
    border-color: color-mix(in srgb, var(--accent, #06b6d4) 55%, #1e293b 45%);
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 70%, rgba(15, 23, 42, 0.85));
    color: #f8fafc;
  }
</style>
