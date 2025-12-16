<script>
  import { createEventDispatcher } from 'svelte';
  import { rangeStore, resetRange, updateRange } from '$lib/state/rangeStore';

  const dispatch = createEventDispatcher();
  export let loading = false;
  const pad = (v) => String(v ?? 0).padStart(2, '0');
  const toDate = (obj) =>
    obj && [obj.year, obj.month, obj.day].every((n) => Number.isFinite(Number(n)))
      ? `${obj.year}-${pad(obj.month)}-${pad(obj.day)}`
      : '';
  const toTime = (obj) => (obj ? `${pad(obj.hour ?? 0)}:${pad(obj.minute ?? 0)}` : '');

  $: state = $rangeStore;
  $: endValue = { ...state.end, date: toDate(state.end), time: toTime(state.end) };

  function submit(event) {
    event.preventDefault();
    dispatch('range', { includeNatal: true });
  }
</script>

<form class="glass-card p-4 space-y-4" on:submit|preventDefault={submit} id="range-form">
  <div class="flex items-center justify-between">
    <div>
      <p class="section-title text-xs">Transit range</p>
      <p class="text-sm text-slate-300">Start from the transit moment and sweep forward.</p>
    </div>
    <button class="button-ghost" type="button" on:click={resetRange}>Reset</button>
  </div>
  <div class="form-grid">
    <div class="space-y-1.5">
      <label>End date</label>
      <input
        type="date"
        value={endValue.date}
        on:input={(e) => {
          const [year, month, day] = e.target.value.split('-').map((v) => parseInt(v, 10));
          updateRange({ end: { year, month, day } });
        }}
      />
    </div>
    <div class="space-y-1.5">
      <label>End time</label>
      <input
        type="time"
        value={endValue.time}
        on:input={(e) => {
          const [hour, minute] = e.target.value.split(':').map((v) => parseInt(v, 10));
          updateRange({ end: { hour, minute } });
        }}
      />
    </div>
    <div class="space-y-1.5">
      <label>Granularity</label>
      <select value={state.granularity} on:change={(e) => updateRange({ granularity: e.target.value })}>
        <option value="minute">Minute</option>
        <option value="hour">Hour</option>
        <option value="day">Day</option>
        <option value="month">Month</option>
      </select>
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
  </div>
  <div class="flex items-center gap-3">
    <button type="submit" class="button-primary" disabled={loading}>Visualize range</button>
    <p class="text-sm text-slate-400">Uses the transit moment + config on this page.</p>
  </div>
</form>
