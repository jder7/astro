<script>
  import { onMount } from 'svelte';
  import { COUNTRY_OPTIONS } from '$lib/data/countryOptions';
  import { TIMEZONE_OPTIONS } from '$lib/data/timezoneOptions';

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
  let showLocationModal = false;

  let modalDate = '';
  let modalTime = '';
  let modalCity = '';
  let modalNation = '';
  let modalTz = '';
  let modalLat = '';
  let modalLng = '';
  let detectedTz = '';

  const countryListId = `${idPrefix}-country-options`;
  const tzListId = `${idPrefix}-timezone-options`;

  const numericOrNull = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  };

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

  const fmtTzOffset = (tz) => {
    if (!tz) return 'GMT';
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
      const name = parts.find((p) => p.type === 'timeZoneName')?.value;
      return name || 'GMT';
    } catch (e) {
      return 'GMT';
    }
  };

  $: locationDisplay = (() => {
    const cityNation = [value.city, value.nation].filter(Boolean).join(', ') || 'City, Country';
    const tz = value.tz_str || '';
    const gmt = fmtTzOffset(value.tz_str);
    return `${cityNation} · ${gmt}`;
  })();

  function openDateModal() {
    modalDate = dateLabel;
    modalTime = timeLabel;
    showDateModal = true;
  }

  function openLocationModal() {
    modalCity = value.city || '';
    modalNation = value.nation || '';
    modalTz = value.tz_str || '';
    modalLat = value.lat ?? '';
    modalLng = value.lng ?? '';
    showLocationModal = true;
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

  async function pasteCoords() {
    try {
      const text = await navigator.clipboard.readText();
      const [latRaw, lngRaw] = text.split(/[,\s]+/);
      const lat = Number.parseFloat(latRaw);
      const lng = Number.parseFloat(lngRaw);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const roundedLat = Number(lat.toFixed(4));
        const roundedLng = Number(lng.toFixed(4));
        modalLat = roundedLat;
        modalLng = roundedLng;
        onChange({ lat: roundedLat, lng: roundedLng, name: nameValue });
      }
    } catch (err) {
      console.warn('Could not read clipboard', err);
    }
  }

  function applyLocation(event) {
    event.preventDefault();
    const lat = numericOrNull(modalLat);
    const lng = numericOrNull(modalLng);
    onChange({ name: nameValue, city: modalCity, nation: modalNation, tz_str: modalTz, lat, lng });
    showLocationModal = false;
  }

  function useDetectedTimezone() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    detectedTz = tz;
    modalTz = tz;
    onChange({ tz_str: tz, name: nameValue });
  }

  $: lookupHref = (() => {
    const query = [modalCity || value.city, modalNation || value.nation].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  })();

  onMount(() => {
    detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  });
</script>

<div class="glass-card p-4 space-y-3">
  <div class="flex items-center justify-between">
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

  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-xs uppercase tracking-[0.25em] text-cyan-200/80 font-semibold">{isTransit ? 'Moment' : 'Birth'}</p>
      <p class="text-sm text-slate-300">{isTransit ? 'When?' : 'Date & time'}</p>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-sm hover:border-cyan-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
        class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-100 shadow-sm hover:border-cyan-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
        on:click={openDateModal}
      >
        <span class="whitespace-nowrap">{datetimeDisplay}</span>
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
        </svg>
        <span class="sr-only">Edit {isTransit ? 'moment' : 'birth datetime'}</span>
      </button>
    </div>
  </div>

  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-xs uppercase tracking-[0.25em] text-cyan-200/80 font-semibold">Location</p>
      <p class="text-sm text-slate-300">{isTransit ? 'Transit spot' : 'Place'}</p>
    </div>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-100 shadow-sm hover:border-cyan-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-left"
      on:click={openLocationModal}
    >
      <span class="text-left leading-snug max-w-[220px] sm:max-w-[260px]">{locationDisplay}</span>
      <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
      </svg>
      <span class="sr-only">Edit location</span>
    </button>
  </div>
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

{#if showLocationModal}
  <div class="modal-backdrop">
    <div class="modal-panel max-w-2xl">
      <div class="flex items-center justify-between border-b border-slate-800 px-1 pb-3 mb-4">
        <div>
          <p class="text-[11px] uppercase tracking-[0.22em] text-cyan-200/70 font-semibold">Location</p>
          <h3 class="text-lg font-semibold text-white">Edit location</h3>
        </div>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-white hover:border-cyan-400"
          aria-label="Close location modal"
          on:click={() => (showLocationModal = false)}
        >
          <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form class="space-y-4" on:submit|preventDefault={applyLocation}>
        <p class="text-sm text-slate-300">City, timezone, and coordinates for this chart.</p>
        <div class="space-y-4">
          <div class="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-xs uppercase tracking-[0.18em] text-cyan-200/80 font-semibold">For display</p>
              <span class="text-[11px] text-slate-400">Shown on the chip</span>
            </div>
            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label class="flowbite-label" for={`${idPrefix}-location-city`}>City</label>
                <input id={`${idPrefix}-location-city`} type="text" class="flowbite-input" bind:value={modalCity} />
              </div>
              <div>
                <label class="flowbite-label" for={`${idPrefix}-location-nation`}>Country code</label>
                <input
                  id={`${idPrefix}-location-nation`}
                  type="text"
                  class="flowbite-input"
                  list={countryListId}
                  placeholder="Search or pick country"
                  bind:value={modalNation}
                />
              </div>
              <div class="sm:col-span-2 text-xs text-slate-400">
                <a
                  href={lookupHref}
                  target="_blank"
                  rel="noreferrer"
                  class="text-cyan-200 hover:text-cyan-100 underline-offset-4 hover:underline"
                >
                  Find coordinates for this city
                </a>
                <p class="mt-1 text-[11px] text-slate-500">
                  Open the map, right-click the city, copy its coordinates, then paste them below.
                </p>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-xs uppercase tracking-[0.18em] text-cyan-200/80 font-semibold">For chart computation</p>
              <span class="text-[11px] text-slate-400">Used in API calls</span>
            </div>
            <div class="space-y-3">
              <div>
                <div class="flex items-center justify-between gap-2">
                  <label class="flowbite-label mb-0" for={`${idPrefix}-location-tz`}>Timezone</label>
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-md border border-slate-700 text-cyan-200 hover:border-cyan-400 hover:text-white"
                    aria-label="Use detected timezone"
                    on:click={useDetectedTimezone}
                  >
                    <span class="text-slate-400">Current timezone:</span>
                    <span class="font-semibold text-cyan-100">{detectedTz || '--'}</span>
                    <span class="text-slate-400">· use this</span>
                  </button>
                </div>
                <input
                  id={`${idPrefix}-location-tz`}
                  type="text"
                  class="flowbite-input"
                  list={tzListId}
                  placeholder="Search or pick timezone (e.g. Europe/Amsterdam)"
                  bind:value={modalTz}
                />
              </div>
              <div class="grid sm:grid-cols-2 gap-3">
                <div>
                  <label class="flowbite-label" for={`${idPrefix}-location-lat`}>Latitude</label>
                  <input id={`${idPrefix}-location-lat`} type="number" step="0.0001" class="flowbite-input" bind:value={modalLat} />
                </div>
                <div>
                  <label class="flowbite-label" for={`${idPrefix}-location-lng`}>Longitude</label>
                  <input id={`${idPrefix}-location-lng`} type="number" step="0.0001" class="flowbite-input" bind:value={modalLng} />
                </div>
                <div class="sm:col-span-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-cyan-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    on:click={pasteCoords}
                  >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Paste coordinates from clipboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button type="submit" class="button-primary w-full">Save</button>
          <button type="button" class="button-ghost w-full" on:click={() => (showLocationModal = false)}>Discard</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<datalist id={countryListId}>
  {#each COUNTRY_OPTIONS as opt}
    <option value={opt.code}>{opt.name}</option>
  {/each}
</datalist>

<datalist id={tzListId}>
  {#each TIMEZONE_OPTIONS as tz}
    <option value={tz}></option>
  {/each}
</datalist>
