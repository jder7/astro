<script>
  export let value = {};
  export let onChange = () => {};
  export let title = 'Transit moment';
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h3 class="section-title text-xs">{title}</h3>
    <span class="tag">Transit</span>
  </div>
  <div class="form-grid">
    <div class="space-y-1.5">
      <label for="transitDate">Date</label>
      <input
        id="transitDate"
        name="transitDate"
        type="date"
        value={value.date || ''}
        on:input={(e) => {
          const [year, month, day] = e.target.value.split('-').map((v) => parseInt(v, 10));
          onChange({ year, month, day });
        }}
      />
    </div>
    <div class="space-y-1.5">
      <label for="transitTime">Time</label>
      <input
        id="transitTime"
        name="transitTime"
        type="time"
        value={value.time || ''}
        on:input={(e) => {
          const [hour, minute] = e.target.value.split(':').map((v) => parseInt(v, 10));
          onChange({ hour, minute });
        }}
      />
    </div>
    <div class="space-y-1.5">
      <label for="transitLat">Latitude</label>
      <input id="transitLat" name="transitLat" type="number" step="0.0001" value={value.lat} on:input={(e) => onChange({ lat: parseFloat(e.target.value) })} />
    </div>
    <div class="space-y-1.5">
      <label for="transitLng">Longitude</label>
      <input id="transitLng" name="transitLng" type="number" step="0.0001" value={value.lng} on:input={(e) => onChange({ lng: parseFloat(e.target.value) })} />
    </div>
    <div class="space-y-1.5">
      <label for="transitTz">Timezone</label>
      <input id="transitTz" name="transitTz" type="text" value={value.tz_str || ''} on:input={(e) => onChange({ tz_str: e.target.value })} />
    </div>
    <div class="space-y-1.5">
      <label for="transitCity">City</label>
      <input id="transitCity" name="transitCity" type="text" value={value.city || ''} on:input={(e) => onChange({ city: e.target.value })} />
    </div>
    <div class="space-y-1.5">
      <label for="transitNation">Nation</label>
      <input id="transitNation" name="transitNation" type="text" value={value.nation || ''} on:input={(e) => onChange({ nation: e.target.value })} />
    </div>
  </div>
</div>
