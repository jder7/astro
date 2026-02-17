<script>
  import LocationResolver from '../shared/LocationResolver.svelte';
  import { subjectHistoryStore, removeSubjectHistory, buildHistoryLabel } from '$lib/state/subjectHistoryStore';
  import { formatNameWithGender } from '$lib/utils/gender';
  import { navigationStore, navigateTransitHistory, updateTransitWithNavigation } from '$lib/state/inputStore';

  export let variant = 'natal'; // 'natal' | 'transit' | 'partner'
  export let value = {};
  export let onChange = () => {};
  export let label = variant === 'transit' ? 'Transit' : variant === 'partner' ? 'Partner' : 'Birth';
  export let tag = variant === 'transit' ? 'Transit' : variant === 'partner' ? 'Synastry' : 'Natal';
  export let idPrefix = variant;

  const quickTimes = ['00:00', '06:00', '12:00', '18:00'];
  const pad = (v) => String(v ?? '').padStart(2, '0');
  const isTransit = variant === 'transit';

  let showDateModal = false;
  let modalDate = '';
  let modalTime = '';
  let showHistory = false;
  let showGender = false;

  const formatDate = (obj) =>
    obj && [obj.year, obj.month, obj.day].every((n) => Number.isFinite(Number(n)))
      ? `${obj.year}-${pad(obj.month)}-${pad(obj.day)}`
      : '';
  const formatTime = (obj) =>
    obj && Number.isFinite(Number(obj.hour)) && Number.isFinite(Number(obj.minute))
      ? `${pad(obj.hour)}:${pad(obj.minute)}`
      : '';

  $: nameValue = value.name ?? (isTransit ? 'Transit' : '');
  $: genderValue = value.gender || '';
  $: dateLabel = formatDate(value);
  $: timeLabel = formatTime(value);
  $: datetimeDisplay = `${dateLabel || 'YYYY-MM-DD'} · ${timeLabel || 'HH:MM'}`;
  $: displayName = formatNameWithGender(nameValue, genderValue);
  $: genderIcon = genderValue === 'female' ? '♀' : genderValue === 'male' ? '♂' : '-';
  $: historyEntries = $subjectHistoryStore || [];
  $: currentHistoryLabel = buildHistoryLabel(value);
  $: navState = $navigationStore;
  $: canBack = (navState?.cursor ?? -1) > 0;
  $: canForward = Array.isArray(navState?.stack) && (navState?.cursor ?? -1) < navState.stack.length - 1;
  function openDateModal() {
    modalDate = dateLabel;
    modalTime = timeLabel;
    showDateModal = true;
  }

  function applyDateTime(event) {
    event.preventDefault();
    const [year, month, day] = (modalDate || '').split('-').map((n) => parseInt(n, 10));
    const [hour, minute] = (modalTime || '').split(':').map((n) => parseInt(n, 10));
    onChange({
      name: nameValue,
      year,
      month,
      day,
      hour,
      minute,
    });
    showDateModal = false;
  }

  function setNow() {
    const now = new Date();
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    modalDate = date;
    modalTime = time;
    const patch = {
      name: nameValue,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
    };
    if (isTransit) {
      updateTransitWithNavigation(patch, { push: true });
    } else {
      onChange(patch);
    }
  }

  function setQuickTime(qt) {
    modalTime = qt;
    const [h, m] = qt.split(':').map((n) => parseInt(n, 10));
    onChange({
      name: nameValue,
      hour: h,
      minute: m,
    });
  }

  const shiftTransitByMinutes = (minutes) => {
    if (!isTransit) return;
    const base = new Date(value.year || 0, (value.month || 1) - 1, value.day || 1, value.hour || 0, value.minute || 0);
    if (Number.isNaN(base.getTime())) return;
    const next = new Date(base.getTime() + minutes * 60000);
    updateTransitWithNavigation(
      {
        year: next.getFullYear(),
        month: next.getMonth() + 1,
        day: next.getDate(),
        hour: next.getHours(),
        minute: next.getMinutes(),
      },
      { push: true }
    );
  };

  const applyHistoryEntry = (entry) => {
    if (!entry?.inputs) return;
    onChange(entry.inputs);
    showHistory = false;
  };
</script>

<div class="glass-card p-4 space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h3 class="section-title text-xs">{label}</h3>
    <span class="tag">{tag}</span>
  </div>

  {#if !isTransit}
    <div class="space-y-2">
      <label class="micro-label" for={`${idPrefix}-name`}>{label} name</label>
      <div class="relative">
        <div class="flex flex-wrap items-center gap-2">
          <input
            class="micro-input flex-1 min-w-[160px]"
            id={`${idPrefix}-name`}
            type="text"
            value={nameValue}
            on:input={(e) => onChange({ name: e.target.value })}
          />
          <div class="flex items-center gap-1" aria-label="Gender">
          <button
            type="button"
            id={`${idPrefix}-gender-toggle`}
            data-action="gender-toggle"
            class={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-xs font-semibold ${
              genderValue ? 'border-cyan-400 text-cyan-100' : 'border-slate-700 text-slate-400'
            }`}
            title={genderValue ? `Gender: ${genderValue}` : 'Gender'}
            aria-label="Toggle gender options"
            on:click={() => (showGender = !showGender)}
          >
            {genderIcon}
          </button>
        </div>
        <button
          type="button"
          id={`${idPrefix}-history-toggle`}
          data-action="history-toggle"
          class="inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-700 bg-slate-800/70 text-xs font-semibold text-slate-100 hover:border-cyan-400 hover:text-white transition"
          on:click={() => (showHistory = !showHistory)}
          aria-expanded={showHistory}
          title="Select from history"
          aria-label="Select from history"
        >
          <span aria-hidden="true">🕘</span>
        </button>
          {#if currentHistoryLabel}
            <span class="text-[11px] text-slate-400">{currentHistoryLabel}</span>
          {/if}
        </div>
        {#if showGender}
          <div class="overlay-backdrop" on:click={() => (showGender = false)} aria-hidden="true"></div>
          <div class="overlay-panel" role="dialog" aria-label="Gender selection">
            <div class="flex items-center gap-2">
              <button
                type="button"
                id={`${idPrefix}-gender-unspecified`}
                data-action="gender-unspecified"
                class={`inline-flex items-center justify-center w-10 h-10 rounded-full border text-xs font-semibold ${
                  genderValue ? 'border-slate-700 text-slate-500' : 'border-cyan-400 text-cyan-100'
                }`}
                title="Gender: Unspecified"
                aria-label="Gender: Unspecified"
                on:click={() => onChange({ gender: '' })}
              >
                —
              </button>
              <button
                type="button"
                id={`${idPrefix}-gender-female`}
                data-action="gender-female"
                class={`inline-flex items-center justify-center w-10 h-10 rounded-full border text-xs font-semibold ${
                  genderValue === 'female' ? 'border-cyan-400 text-cyan-100' : 'border-slate-700 text-slate-500'
                }`}
                title="Gender: Female"
                aria-label="Gender: Female"
                on:click={() => onChange({ gender: 'female' })}
              >
                ♀
              </button>
              <button
                type="button"
                id={`${idPrefix}-gender-male`}
                data-action="gender-male"
                class={`inline-flex items-center justify-center w-10 h-10 rounded-full border text-xs font-semibold ${
                  genderValue === 'male' ? 'border-cyan-400 text-cyan-100' : 'border-slate-700 text-slate-500'
                }`}
                title="Gender: Male"
                aria-label="Gender: Male"
                on:click={() => onChange({ gender: 'male' })}
              >
                ♂
              </button>
            </div>
          </div>
        {/if}
        {#if showHistory}
          <div class="overlay-backdrop" on:click={() => (showHistory = false)} aria-hidden="true"></div>
          <div class="overlay-panel overlay-panel--wide" role="dialog" aria-label="Input history">
            {#if historyEntries.length}
              <div class="space-y-2">
                {#each historyEntries as entry}
                  <div class="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      class="text-left text-xs text-slate-200 hover:text-white"
                      on:click={() => applyHistoryEntry(entry)}
                    >
                      {entry.label || buildHistoryLabel(entry.inputs)}
                    </button>
                    <button
                      type="button"
                      class="text-xs text-slate-400 hover:text-rose-300"
                      on:click={() => removeSubjectHistory(entry.id)}
                      aria-label="Remove history entry"
                    >
                      ✕
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-slate-500">No saved entries yet.</p>
            {/if}
          </div>
        {/if}
      </div>
      {#if displayName}
        <p class="text-[11px] text-slate-400">Display: {displayName}</p>
      {/if}
    </div>
  {:else}
    <input type="hidden" value={nameValue} />
  {/if}

  <div class="form-row">
    <div>
      <p class="text-xs uppercase tracking-[0.25em] text-cyan-200/80 font-semibold">{isTransit ? 'Moment' : 'Birth'}</p>
      <p class="text-sm text-slate-300">{isTransit ? 'When?' : 'Date & time'}</p>
    </div>
    <div class="form-row-actions">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-100 shadow-sm hover:border-cyan-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 justify-center"
        on:click={openDateModal}
      >
        <span class="whitespace-normal sm:whitespace-nowrap break-words min-w-0">{datetimeDisplay}</span>
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
        </svg>
        <span class="sr-only">Edit {isTransit ? 'moment' : 'birth datetime'}</span>
      </button>
    </div>
  </div>

  <LocationResolver
    idPrefix={idPrefix}
    value={value}
    onChange={onChange}
    subtitle={isTransit ? 'Transit spot' : 'Place'}
  />

  {#if isTransit}
    <div class="flex flex-wrap gap-2 text-xs" id={`${idPrefix}-time-jump`} data-group="transit-time-jump">
      <button
        type="button"
        id={`${idPrefix}-nav-now`}
        data-action="transit-now"
        class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-sm hover:border-cyan-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 justify-center"
        on:click={setNow}
      >
        <svg class="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l3 3" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        Now
      </button>
      <button
        type="button"
        id={`${idPrefix}-nav-back`}
        data-action="transit-back"
        class={`inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-700 bg-slate-800/80 text-xs font-semibold ${
          canBack ? 'text-slate-100 hover:border-cyan-400 hover:text-white' : 'text-slate-500 opacity-50'
        }`}
        on:click={() => navigateTransitHistory(-1)}
        aria-label="Back"
        disabled={!canBack}
      >
        ‹
      </button>
      <button
        type="button"
        id={`${idPrefix}-nav-forward`}
        data-action="transit-forward"
        class={`inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-700 bg-slate-800/80 text-xs font-semibold ${
          canForward ? 'text-slate-100 hover:border-cyan-400 hover:text-white' : 'text-slate-500 opacity-50'
        }`}
        on:click={() => navigateTransitHistory(1)}
        aria-label="Forward"
        disabled={!canForward}
      >
        ›
      </button>
      <button
        type="button"
        id={`${idPrefix}-jump-plus-1d`}
        data-action="transit-plus-1d"
        class="button-ghost"
        on:click={() => shiftTransitByMinutes(60 * 24)}
      >
        +1d
      </button>
      <button
        type="button"
        id={`${idPrefix}-jump-plus-1w`}
        data-action="transit-plus-1w"
        class="button-ghost"
        on:click={() => shiftTransitByMinutes(60 * 24 * 7)}
      >
        +1w
      </button>
      <button
        type="button"
        id={`${idPrefix}-jump-plus-1m`}
        data-action="transit-plus-1m"
        class="button-ghost"
        on:click={() => shiftTransitByMinutes(60 * 24 * 30)}
      >
        +1m
      </button>
    </div>
  {/if}
</div>

<style>
  .overlay-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: transparent;
  }

  .overlay-panel {
    position: absolute;
    z-index: 50;
    right: 0;
    top: calc(100% + 6px);
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.96);
    padding: 0.6rem;
    box-shadow: 0 18px 40px rgba(2, 6, 23, 0.45);
    min-width: 180px;
  }

  .overlay-panel--wide {
    min-width: 260px;
  }
</style>

{#if showDateModal}
  <div class="modal-backdrop">
    <div class="modal-panel max-w-md">
      <div class="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <div>
          <p class="text-[11px] uppercase tracking-[0.22em] text-cyan-200/70 font-semibold">Datetime</p>
          <h3 class="text-lg font-semibold text-white">Edit {isTransit ? 'moment' : 'birth'}</h3>
        </div>
        <button class="icon-button" type="button" aria-label="Close" on:click={() => (showDateModal = false)}>✕</button>
      </div>
      <form class="space-y-4" on:submit|preventDefault={applyDateTime}>
        <div class="grid sm:grid-cols-2 gap-3">
          <div>
            <label class="flowbite-label" for={`${idPrefix}-modal-date`}>Date</label>
            <input class="flowbite-input" id={`${idPrefix}-modal-date`} type="date" bind:value={modalDate} />
          </div>
          <div>
            <label class="flowbite-label" for={`${idPrefix}-modal-time`}>Time</label>
            <input class="flowbite-input" id={`${idPrefix}-modal-time`} type="time" bind:value={modalTime} />
          </div>
        </div>

        <div class="grid grid-cols-4 gap-2 text-xs">
          <button type="button" class="button-ghost col-span-2 sm:col-span-1" on:click={setNow}>Now</button>
          {#each quickTimes as qt}
            <button type="button" class="button-ghost" on:click={() => setQuickTime(qt)}>{qt}</button>
          {/each}
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button type="submit" class="button-primary w-full">Save</button>
          <button type="button" class="button-ghost w-full" on:click={() => (showDateModal = false)}>Discard</button>
        </div>
      </form>
    </div>
  </div>
{/if}
