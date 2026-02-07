<script>
  import { onMount, tick } from 'svelte';
  import { COUNTRY_OPTIONS } from '$lib/data/countryOptions';
  import { TIMEZONE_OPTIONS } from '$lib/data/timezoneOptions';
  import { requestGeoStatus, resolveGeoLocation, searchGeoLocations } from '$lib/api/client';

  export let value = {};
  export let onChange = () => {};
  export let idPrefix = 'location';
  export let subtitle = 'Place';

  const countryListId = `${idPrefix}-country-options`;
  const tzListId = `${idPrefix}-timezone-options`;

  let showModal = false;
  let modalCity = '';
  let modalNation = '';
  let modalTz = '';
  let modalLat = '';
  let modalLng = '';
  let detectedTz = '';

  let apiActive = false;
  let apiChecked = false;
  let apiMessage = '';

  let manualOpen = false;
  let searchQuery = '';
  let searchResults = [];
  let searchLoading = false;
  let searchError = '';
  let resolvingId = '';
  let appliedLabel = '';
  let selectionPulse = false;
  let searchToken = 0;
  let searchInput;
  let hasSubmitted = false;
  let lastQuery = '';
  let searchTimer;

  const portal = (node) => {
    if (typeof document === 'undefined') return {};
    const target = document.body;
    target.appendChild(node);
    return {
      destroy() {
        if (node && node.parentNode === target) {
          target.removeChild(node);
        }
      },
    };
  };

  const numericOrNull = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  };

  const toFixedCoord = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Number(n.toFixed(4)) : null;
  };

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

  const formatCoord = (value) => {
    if (value === null || value === undefined || value === '') return '--';
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(4) : '--';
  };

  const syncFromValue = () => {
    modalCity = value.city || '';
    modalNation = value.nation || '';
    modalTz = value.tz_str || '';
    modalLat = value.lat ?? '';
    modalLng = value.lng ?? '';
  };

  const markApplied = (label) => {
    appliedLabel = label || '';
    selectionPulse = true;
    setTimeout(() => {
      selectionPulse = false;
    }, 1100);
  };

  async function ensureApiStatus(force = false) {
    if (apiChecked && !force) return;
    try {
      const status = await requestGeoStatus();
      apiActive = Boolean(status?.active);
      apiMessage = status?.message || '';
    } catch (err) {
      apiActive = false;
      apiMessage = 'Location search is offline.';
    } finally {
      apiChecked = true;
      if (!apiActive) {
        manualOpen = true;
      }
    }
  }

  async function openModal() {
    syncFromValue();
    showModal = true;
    await ensureApiStatus(true);
    await tick();
    if (apiActive && searchInput) {
      searchInput.focus();
    }
  }

  function closeModal() {
    clearTimeout(searchTimer);
    showModal = false;
  }

  async function performSearch(query) {
    const token = ++searchToken;
    searchLoading = true;
    searchError = '';
    try {
      const response = await searchGeoLocations(query);
      if (token !== searchToken) return;
      searchResults = response?.results || [];
    } catch (err) {
      if (token !== searchToken) return;
      searchResults = [];
      searchError = err?.message || 'Unable to search right now.';
    } finally {
      if (token === searchToken) {
        searchLoading = false;
      }
    }
  }

  function handleSearchInput() {
    hasSubmitted = false;
    searchError = '';
    if (searchResults.length && searchQuery.trim() !== lastQuery) {
      searchResults = [];
    }
    scheduleAutoSearch();
  }

  async function runSearch(query) {
    hasSubmitted = true;
    if (query.length < 2) {
      searchResults = [];
      searchError = 'Type at least 2 characters to search.';
      searchLoading = false;
      return;
    }
    if (query === lastQuery && searchResults.length) {
      return;
    }
    lastQuery = query;
    await performSearch(query);
  }

  function scheduleAutoSearch() {
    if (!showModal || !apiActive) return;
    const query = searchQuery.trim();
    clearTimeout(searchTimer);
    if (query.length < 2) {
      searchLoading = false;
      return;
    }
    searchTimer = setTimeout(() => {
      runSearch(query);
    }, 1000);
  }

  async function submitSearch(event) {
    event.preventDefault();
    if (!showModal || !apiActive) return;
    clearTimeout(searchTimer);
    const query = searchQuery.trim();
    await runSearch(query);
  }

  async function resolveSelection(result) {
    if (!result) return;
    const targetId = result.place_id || result.label;
    resolvingId = targetId;
    let resolved = result;
    if (result.place_id) {
      try {
        resolved = await resolveGeoLocation(result.place_id);
      } catch (err) {
        resolved = result;
        searchError = err?.message || 'Unable to resolve this location.';
      }
    }
    const next = {};
    if (resolved?.city) {
      next.city = resolved.city;
      modalCity = resolved.city;
    }
    if (resolved?.country_code) {
      next.nation = resolved.country_code;
      modalNation = resolved.country_code;
    }
    const nextLat = toFixedCoord(resolved?.lat);
    const nextLng = toFixedCoord(resolved?.lng);
    if (nextLat !== null) {
      next.lat = nextLat;
      modalLat = nextLat;
    }
    if (nextLng !== null) {
      next.lng = nextLng;
      modalLng = nextLng;
    }
    if (resolved?.tz_str) {
      next.tz_str = resolved.tz_str;
      modalTz = resolved.tz_str;
    }
    if (Object.keys(next).length) {
      onChange(next);
      markApplied(resolved?.label || result.label);
      closeModal();
    }
    resolvingId = '';
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
        onChange({ lat: roundedLat, lng: roundedLng });
      }
    } catch (err) {
      console.warn('Could not read clipboard', err);
    }
  }

  function applyManual(event) {
    event.preventDefault();
    const lat = numericOrNull(modalLat);
    const lng = numericOrNull(modalLng);
    onChange({ city: modalCity, nation: modalNation, tz_str: modalTz, lat, lng });
    showModal = false;
  }

  function useDetectedTimezone() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    detectedTz = tz;
    modalTz = tz;
    onChange({ tz_str: tz });
  }

  $: locationDisplay = (() => {
    const cityNation = [value.city, value.nation].filter(Boolean).join(', ') || 'City, Country';
    const gmt = fmtTzOffset(value.tz_str);
    return `${cityNation} - ${gmt}`;
  })();

  $: lookupHref = (() => {
    const query = [modalCity || value.city, modalNation || value.nation].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  })();

  $: if (!showModal) {
    searchError = '';
    resolvingId = '';
    searchResults = [];
    searchLoading = false;
    hasSubmitted = false;
    lastQuery = '';
  }

  onMount(() => {
    detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    ensureApiStatus();
  });
</script>

<div class="form-row">
  <div>
    <p class="text-xs uppercase tracking-[0.25em] text-cyan-200/80 font-semibold">Location</p>
    <p class="text-sm text-slate-300">{subtitle}</p>
  </div>
  <div class="form-row-actions">
    <button
      type="button"
      class={`location-trigger inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-100 shadow-sm hover:border-cyan-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-left justify-between min-w-0 ${
        selectionPulse ? 'pulse-once' : ''
      }`}
      on:click={openModal}
    >
      <span class="text-left leading-snug max-w-full sm:max-w-[260px] break-words min-w-0 flex-1">{locationDisplay}</span>
      <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
      </svg>
      <span class="sr-only">Edit location</span>
    </button>
  </div>
</div>

{#if showModal}
  <div class="modal-backdrop" use:portal>
    <div class="modal-panel max-w-3xl location-modal">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-1 pb-3 mb-4">
        <div>
          <p class="text-[11px] uppercase tracking-[0.22em] text-cyan-200/70 font-semibold">Location</p>
          <h3 class="text-lg font-semibold text-white">Find coordinates</h3>
        </div>
        <div class="flex items-center gap-2 text-[11px] text-slate-400">
          <span class={`status-pill ${apiActive ? 'online' : 'offline'}`}>{apiActive ? 'Geo search online' : 'Geo search service offline'}</span>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-white hover:border-cyan-400"
            aria-label="Close location modal"
            on:click={closeModal}
          >
            <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div class="space-y-4">
        {#if apiActive}
          <div class={`location-search-panel ${searchQuery.trim().length ? 'has-value' : ''}`}>
            <form class="search-form" on:submit|preventDefault={submitSearch}>
              <label class="flowbite-label" for={`${idPrefix}-location-search`}>Search location</label>
              <div class="search-shell">
                <input
                  class="search-input"
                  id={`${idPrefix}-location-search`}
                  type="search"
                  placeholder="Search city, region, or address"
                  bind:value={searchQuery}
                  bind:this={searchInput}
                  on:input={handleSearchInput}
                />
                <div class="search-orb" aria-hidden="true"></div>
                <button class="search-button" type="submit" disabled={!searchQuery.trim() || searchLoading}>
                  Search
                </button>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>Auto-search starts 1s after you stop typing.</span>
                {#if searchLoading}
                  <span class="text-cyan-200">Searching...</span>
                {:else if appliedLabel}
                  <span class="text-emerald-200">Applied: {appliedLabel}</span>
                {/if}
              </div>
            </form>

            <div class="search-results">
              {#if searchLoading}
                <div class="search-placeholder">Looking up places...</div>
              {:else if searchResults.length}
                {#each searchResults as result}
                  <button
                    type="button"
                    class={`result-card ${resolvingId === (result.place_id || result.label) ? 'is-loading' : ''}`}
                    on:click={() => resolveSelection(result)}
                  >
                    <div class="result-main">{result.label}</div>
                  </button>
                {/each}
              {:else if hasSubmitted}
                <div class="search-placeholder">No matches yet. Try a nearby region or landmark.</div>
              {:else}
                <div class="search-placeholder">Type a city name and press Enter.</div>
              {/if}
              {#if searchError}
                <div class="search-error">{searchError}</div>
              {/if}
            </div>
            <div class="selection-line">
              <span>{value.city || 'City'}</span>
              <span>{value.nation || '--'}</span>
              <span>{formatCoord(value.lat)},{formatCoord(value.lng)}</span>
              <span>{value.tz_str || '--'}</span>
            </div>
          </div>
        {:else}
          <div class="location-offline">
            <p class="text-sm text-slate-200">Location search is offline.</p>
            <p class="text-[11px] text-slate-500">{apiMessage || 'Use manual entry to set coordinates.'}</p>
          </div>
        {/if}

        <details class="manual-panel" bind:open={manualOpen}>
          <summary class="manual-summary">
            <span class="text-xs uppercase tracking-[0.18em] text-cyan-200/80 font-semibold">Manual coordinates</span>
            <span class="text-[11px] text-slate-400">Fill or adjust details</span>
          </summary>
          <form class="space-y-4" on:submit|preventDefault={applyManual}>
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
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <label class="flowbite-label mb-0" for={`${idPrefix}-location-tz`}>Timezone</label>
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-md border border-slate-700 text-cyan-200 hover:border-cyan-400 hover:text-white"
                      aria-label="Use detected timezone"
                      on:click={useDetectedTimezone}
                    >
                      <span class="text-slate-400">Current timezone:</span>
                      <span class="font-semibold text-cyan-100">{detectedTz || '--'}</span>
                      <span class="text-slate-400">use this</span>
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

            <div class="grid grid-cols-2 gap-2">
              <button type="submit" class="button-primary w-full">Save</button>
              <button type="button" class="button-ghost w-full" on:click={closeModal}>Discard</button>
            </div>
          </form>
        </details>
      </div>
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

<style>
  .location-modal {
    background: radial-gradient(circle at top right, rgba(14, 165, 233, 0.16), transparent 55%),
      radial-gradient(circle at 20% 20%, rgba(34, 197, 94, 0.12), transparent 55%),
      rgba(15, 23, 42, 0.92);
  }

  .location-trigger.pulse-once {
    animation: pulse-ring 0.9s ease;
  }

  .status-pill {
    padding: 0.25rem 0.5rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(15, 23, 42, 0.55);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .status-pill.online {
    border-color: rgba(34, 197, 94, 0.7);
    color: rgba(187, 247, 208, 0.95);
  }

  .status-pill.offline {
    border-color: rgba(248, 113, 113, 0.65);
    color: rgba(254, 202, 202, 0.9);
  }

  .location-search-panel {
    border-radius: 1.25rem;
    padding: 1rem;
    border: 1px solid rgba(30, 41, 59, 0.7);
    background: linear-gradient(140deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.7));
    box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.15);
  }

  .search-shell {
    position: relative;
    border-radius: 0.9rem;
    border: 1px solid rgba(30, 41, 59, 0.9);
    background: rgba(15, 23, 42, 0.85);
    overflow: hidden;
  }

  .search-input {
    width: 100%;
    background: transparent;
    border: none;
    padding: 0.7rem 6.4rem 0.7rem 0.9rem;
    font-size: 0.9rem;
    color: #e2e8f0;
  }

  .search-input:focus {
    outline: none;
  }

  .search-orb {
    position: absolute;
    right: 6rem;
    top: 50%;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    background: rgba(14, 165, 233, 0.9);
    box-shadow: 0 0 12px rgba(14, 165, 233, 0.9);
    transform: translateY(-50%);
    animation: orb-pulse 2s ease-in-out infinite;
  }

  .search-button {
    position: absolute;
    right: 0.4rem;
    top: 50%;
    transform: translateY(-50%);
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px solid rgba(14, 165, 233, 0.6);
    background: rgba(14, 165, 233, 0.2);
    color: rgba(186, 230, 253, 0.95);
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .search-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .search-results {
    margin-top: 0.75rem;
    display: grid;
    gap: 0.5rem;
  }

  .selection-line {
    margin-top: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(148, 163, 184, 0.85);
  }

  .selection-line span {
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    border: 1px solid rgba(30, 41, 59, 0.7);
    background: rgba(15, 23, 42, 0.6);
  }

  .result-card {
    text-align: left;
    padding: 0.75rem;
    border-radius: 0.9rem;
    border: 1px solid rgba(51, 65, 85, 0.8);
    background: rgba(15, 23, 42, 0.7);
    transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
  }

  .result-card:hover {
    transform: translateY(-1px);
    border-color: rgba(14, 165, 233, 0.6);
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.5);
  }

  .result-card.is-loading {
    opacity: 0.7;
  }

  .result-main {
    font-size: 0.9rem;
    color: #f8fafc;
    font-weight: 600;
  }

  .result-meta {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: rgba(148, 163, 184, 0.9);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .coord-pill {
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    border: 1px solid rgba(30, 41, 59, 0.9);
    background: rgba(15, 23, 42, 0.85);
    color: rgba(186, 230, 253, 0.95);
  }

  .search-placeholder {
    font-size: 0.8rem;
    color: rgba(148, 163, 184, 0.85);
    padding: 0.65rem 0.75rem;
    border-radius: 0.75rem;
    border: 1px dashed rgba(51, 65, 85, 0.7);
  }

  .search-error {
    font-size: 0.75rem;
    color: rgba(248, 113, 113, 0.9);
    padding: 0.5rem 0.75rem;
  }

  .location-offline {
    border-radius: 1rem;
    padding: 0.9rem 1rem;
    border: 1px solid rgba(71, 85, 105, 0.6);
    background: rgba(15, 23, 42, 0.7);
  }

  .manual-panel {
    border-radius: 1rem;
    border: 1px solid rgba(30, 41, 59, 0.7);
    padding: 0.5rem 0.75rem 0.75rem;
    background: rgba(15, 23, 42, 0.7);
  }

  .manual-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    padding: 0.3rem 0.2rem 0.5rem;
  }

  .manual-summary::-webkit-details-marker {
    display: none;
  }

  @keyframes orb-pulse {
    0% {
      opacity: 0.7;
      transform: translateY(-50%) scale(1);
    }
    50% {
      opacity: 1;
      transform: translateY(-50%) scale(1.4);
    }
    100% {
      opacity: 0.7;
      transform: translateY(-50%) scale(1);
    }
  }

  @keyframes pulse-ring {
    0% {
      box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.55);
    }
    70% {
      box-shadow: 0 0 0 12px rgba(14, 165, 233, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(14, 165, 233, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .location-trigger.pulse-once,
    .search-orb {
      animation: none;
    }

    .result-card {
      transition: none;
    }
  }
</style>
