<script>
  import { createEventDispatcher } from 'svelte';
  import { rangeStore, resetRange, updateRange } from '$lib/state/rangeStore';
  import { inputStore } from '$lib/state/inputStore';

  const dispatch = createEventDispatcher();
  export let loading = false;
  const pad = (v) => String(v ?? 0).padStart(2, '0');
  const toDateObj = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date?.getTime?.()) ? date : null;
  };
  const toDateStr = (obj) =>
    obj && [obj.year, obj.month, obj.day].every((n) => Number.isFinite(Number(n)))
      ? `${obj.year}-${pad(obj.month)}-${pad(obj.day)}`
      : '';
  const toTimeStr = (obj) => (obj ? `${pad(obj.hour ?? 0)}:${pad(obj.minute ?? 0)}` : '');
  const toDateTimeStr = (obj) => {
    const date = toDateStr(obj);
    const time = toTimeStr(obj);
    return date && time ? `${date}T${time}` : '';
  };
  const fromDateTimeStr = (value, fallback) => {
    const parsed = toDateObj(value);
    if (!parsed && fallback) return fallback;
    if (!parsed) return null;
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
      hour: parsed.getHours(),
      minute: parsed.getMinutes(),
    };
  };
  const addMonths = (date, months) => {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  };
  const toParts = (date) =>
    date instanceof Date && Number.isFinite(date.getTime())
      ? {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          hour: date.getHours(),
          minute: date.getMinutes(),
        }
      : null;

  $: state = $rangeStore;
  $: transit = $inputStore?.transit || {};
  $: if (!state.start && transit?.year) {
    updateRange({ start: transit });
  }
  $: startValue = state.start || transit;
  $: endValue = state.end || transit;
  $: startDateTime = toDateTimeStr(startValue);
  $: endDateTime = toDateTimeStr(endValue);
  $: derivedGranularity = (() => {
    const start = toDateObj(startDateTime);
    const end = toDateObj(endDateTime);
    if (!(start && end)) return state.granularity || 'hour';
    const ms = Math.max(0, end.getTime() - start.getTime());
    const days = ms / (1000 * 60 * 60 * 24);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (days < 3) return 'hour';
    if (months < 3) return 'day';
    return 'month';
  })();

  $: if (state.granularity !== derivedGranularity) {
    updateRange({ granularity: derivedGranularity });
  }

  function submit(event) {
    event.preventDefault();
    dispatch('range', { includeNatal: true });
  }

  const syncStart = (value) => {
    const next = fromDateTimeStr(value, startValue);
    if (!next) return;
    updateRange({ start: next });
    const end = toDateObj(endDateTime);
    const nextDate = toDateObj(`${toDateStr(next)}T${toTimeStr(next)}`);
    if (end && nextDate && end < nextDate) {
      updateRange({ end: next });
    }
  };

  const syncEnd = (value) => {
    const next = fromDateTimeStr(value, endValue);
    if (!next) return;
    const start = toDateObj(startDateTime);
    const nextDate = toDateObj(`${toDateStr(next)}T${toTimeStr(next)}`);
    if (start && nextDate && nextDate < start) {
      updateRange({ end: { year: start.getFullYear(), month: start.getMonth() + 1, day: start.getDate(), hour: start.getHours(), minute: start.getMinutes() } });
      return;
    }
    updateRange({ end: next });
  };

  const quickSet = (label) => {
    const now = new Date();
    let end = new Date(now);
    if (label === 'day') {
      end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (label === 'month') {
      end = addMonths(now, 1);
    } else if (label === 'three_months') {
      end = addMonths(now, 3);
    } else if (label === 'year') {
      end.setFullYear(now.getFullYear() + 1);
    }
    const startParts = toParts(now);
    const endParts = toParts(end);
    if (startParts && endParts) {
      updateRange({ start: startParts, end: endParts });
    }
  };
</script>

<form class="glass-card p-4 space-y-4" on:submit|preventDefault={submit} id="range-form">
  <div class="flex items-center justify-between">
    <div>
      <p class="section-title text-xs">Transit range</p>
      <p class="text-sm text-slate-300">Pick a window; cadence auto-adjusts to hour/day/month.</p>
    </div>
    <button class="button-ghost" type="button" on:click={resetRange}>Reset</button>
  </div>
  <div class="form-grid">
    <div class="space-y-1.5">
      <label for="range-start">Start (transit)</label>
      <input
        id="range-start"
        type="datetime-local"
        value={startDateTime}
        on:input={(e) => syncStart(e.target.value)}
      />
    </div>
    <div class="space-y-1.5">
      <label for="range-end">End</label>
      <input
        id="range-end"
        type="datetime-local"
        value={endDateTime}
        on:input={(e) => syncEnd(e.target.value)}
      />
    </div>
  </div>

  <div class="flex flex-wrap gap-2">
    <button type="button" class="compact-button" on:click={() => quickSet('day')}>Next Day</button>
    <button type="button" class="compact-button" on:click={() => quickSet('month')}>Next Month</button>
    <button type="button" class="compact-button" on:click={() => quickSet('three_months')}>3 Months</button>
    <button type="button" class="compact-button" on:click={() => quickSet('year')}>Next Year</button>
    <span class="compact-chip">Cadence: {derivedGranularity}</span>
  </div>

  <label class="flex items-center gap-2 text-sm">
    <input
      type="checkbox"
      class="rounded border-slate-700"
      checked={state.include_aspects}
      on:change={(e) => updateRange({ include_aspects: e.target.checked })}
    />
    Include aspects for each snapshot
  </label>

  <div class="flex items-center gap-3 flex-wrap">
    <button type="submit" class="button-primary" disabled={loading}>Visualize range</button>
    <p class="text-sm text-slate-400">Uses the transit moment + config on this page.</p>
  </div>
</form>
