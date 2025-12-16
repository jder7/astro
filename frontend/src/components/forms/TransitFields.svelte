<script>
  export let value = {};
  export let onChange = () => {};
  export let title = 'Transit moment';
</script>

<div class="glass-card p-4 space-y-3">
  <div class="flex items-center justify-between">
    <h3 class="section-title text-xs">{title}</h3>
    <span class="tag">Transit</span>
  </div>
  <div class="micro-grid">
    <div class="space-y-1">
      <label class="micro-label" for="transitDate">Date</label>
      <input
        class="micro-input"
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
    <div class="space-y-1">
      <label class="micro-label" for="transitTime">Time</label>
      <input
        class="micro-input"
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
    <div class="space-y-1">
      <label class="micro-label" for="transitLat">Lat</label>
      <input class="micro-input" id="transitLat" name="transitLat" type="number" step="0.0001" value={value.lat} on:input={(e) => onChange({ lat: parseFloat(e.target.value) })} />
    </div>
    <div class="space-y-1">
      <label class="micro-label" for="transitLng">Lng</label>
      <input class="micro-input" id="transitLng" name="transitLng" type="number" step="0.0001" value={value.lng} on:input={(e) => onChange({ lng: parseFloat(e.target.value) })} />
    </div>
    <div class="space-y-1">
      <label class="micro-label" for="transitTz">TZ</label>
      <input class="micro-input" id="transitTz" name="transitTz" type="text" value={value.tz_str || ''} on:input={(e) => onChange({ tz_str: e.target.value })} />
    </div>
    <div class="space-y-1">
      <label class="micro-label" for="transitCity">City</label>
      <input class="micro-input" id="transitCity" name="transitCity" type="text" value={value.city || ''} on:input={(e) => onChange({ city: e.target.value })} />
    </div>
    <div class="space-y-1">
      <label class="micro-label" for="transitNation">Nation</label>
      <input class="micro-input" id="transitNation" name="transitNation" type="text" value={value.nation || ''} on:input={(e) => onChange({ nation: e.target.value })} />
    </div>
  </div>
</div>
