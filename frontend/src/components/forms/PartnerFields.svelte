<script>
  export let value = {};
  export let label = 'Partner';
  export let onChange = () => {};
</script>

<div class="glass-card p-4 space-y-3">
  <div class="flex items-center justify-between">
    <p class="font-semibold text-sm text-slate-100">{label}</p>
    <span class="badge">Synastry</span>
  </div>
  <div class="grid grid-cols-2 gap-3 text-sm">
    <div class="col-span-2 space-y-1.5">
      <label>{label} name</label>
      <input type="text" value={value.name || ''} on:input={(e) => onChange({ name: e.target.value })} />
    </div>
    <div class="space-y-1.5">
      <label>Date</label>
      <input
        type="date"
        value={value.date || ''}
        on:input={(e) => {
          const [year, month, day] = e.target.value.split('-').map((n) => parseInt(n, 10));
          onChange({ year, month, day });
        }}
      />
    </div>
    <div class="space-y-1.5">
      <label>Time</label>
      <input
        type="time"
        value={value.time || ''}
        on:input={(e) => {
          const [hour, minute] = e.target.value.split(':').map((n) => parseInt(n, 10));
          onChange({ hour, minute });
        }}
      />
    </div>
    <div class="space-y-1.5">
      <label>Latitude</label>
      <input type="number" step="0.0001" value={value.lat} on:input={(e) => onChange({ lat: parseFloat(e.target.value) })} />
    </div>
    <div class="space-y-1.5">
      <label>Longitude</label>
      <input type="number" step="0.0001" value={value.lng} on:input={(e) => onChange({ lng: parseFloat(e.target.value) })} />
    </div>
    <div class="space-y-1.5">
      <label>Timezone</label>
      <input type="text" value={value.tz_str || ''} on:input={(e) => onChange({ tz_str: e.target.value })} />
    </div>
    <div class="space-y-1.5">
      <label>City</label>
      <input type="text" value={value.city || ''} on:input={(e) => onChange({ city: e.target.value })} />
    </div>
    <div class="space-y-1.5">
      <label>Nation</label>
      <input type="text" value={value.nation || ''} on:input={(e) => onChange({ nation: e.target.value })} />
    </div>
  </div>
</div>
