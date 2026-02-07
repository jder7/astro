<script>
  import LocationResolver from '../shared/LocationResolver.svelte';

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

  const formatDate = (obj) =>
    obj && [obj.year, obj.month, obj.day].every((n) => Number.isFinite(Number(n)))
      ? `${obj.year}-${pad(obj.month)}-${pad(obj.day)}`
      : '';
  const formatTime = (obj) =>
    obj && Number.isFinite(Number(obj.hour)) && Number.isFinite(Number(obj.minute))
      ? `${pad(obj.hour)}:${pad(obj.minute)}`
      : '';

  $: nameValue = value.name ?? (isTransit ? 'Transit' : '');
  $: dateLabel = formatDate(value);
  $: timeLabel = formatTime(value);
  $: datetimeDisplay = `${dateLabel || 'YYYY-MM-DD'} · ${timeLabel || 'HH:MM'}`;
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
    onChange({
      name: nameValue,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
    });
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
</script>

<div class="glass-card p-4 space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h3 class="section-title text-xs">{label}</h3>
    <span class="tag">{tag}</span>
  </div>

  {#if !isTransit}
    <div class="space-y-2">
      <label class="micro-label" for={`${idPrefix}-name`}>{label} name</label>
      <input
        class="micro-input"
        id={`${idPrefix}-name`}
        type="text"
        value={nameValue}
        on:input={(e) => onChange({ name: e.target.value })}
      />
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
      {#if isTransit}
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-sm hover:border-cyan-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 justify-center"
          on:click={setNow}
        >
          <svg class="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l3 3" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          Now
        </button>
      {/if}
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
</div>

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
