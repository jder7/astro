<script>
  export let value = {};
  export let onChange = () => {};
  export let title = 'Birth';
</script>

<div class="glass-card p-4 space-y-3">
  <div class="flex items-center justify-between">
    <h3 class="section-title text-xs">{title}</h3>
    <span class="tag">Natal</span>
  </div>
  <div class="micro-grid">
    <div class="full space-y-1">
      <label class="micro-label" for="name">Name</label>
      <input class="micro-input" id="name" name="name" type="text" value={value.name || ''} on:input={(e) => onChange({ name: e.target.value })} />
    </div>
    <div class="space-y-1">
      <label class="micro-label" for="birthDate">Date</label>
      <input
        class="micro-input"
        id="birthDate"
        name="birthDate"
        type="date"
        value={value.date || value.birthDate || ''}
        on:input={(e) => {
          const [year, month, day] = e.target.value.split('-').map((v) => parseInt(v, 10));
          onChange({ year, month, day });
        }}
      />
    </div>
    <div class="space-y-1">
      <label class="micro-label" for="birthTime">Time</label>
      <input
        class="micro-input"
        id="birthTime"
        name="birthTime"
        type="time"
        value={value.time || ''}
        on:input={(e) => {
          const [hour, minute] = e.target.value.split(':').map((v) => parseInt(v, 10));
          onChange({ hour, minute });
        }}
      />
    </div>
    <div class="space-y-1">
      <label class="micro-label" for="lat">Lat</label>
      <input class="micro-input" id="lat" name="lat" type="number" step="0.0001" value={value.lat} on:input={(e) => onChange({ lat: parseFloat(e.target.value) })} />
    </div>
    <div class="space-y-1">
      <label class="micro-label" for="lng">Lng</label>
      <input class="micro-input" id="lng" name="lng" type="number" step="0.0001" value={value.lng} on:input={(e) => onChange({ lng: parseFloat(e.target.value) })} />
    </div>
    <div class="space-y-1">
      <label class="micro-label" for="tz">TZ</label>
      <input class="micro-input" id="tz" name="tz" type="text" value={value.tz_str || ''} on:input={(e) => onChange({ tz_str: e.target.value })} />
    </div>
    <div class="space-y-1">
      <label class="micro-label" for="city">City</label>
      <input class="micro-input" id="city" name="city" type="text" value={value.city || ''} on:input={(e) => onChange({ city: e.target.value })} />
    </div>
    <div class="space-y-1">
      <label class="micro-label" for="nation">Nation</label>
      <input class="micro-input" id="nation" name="nation" type="text" value={value.nation || ''} on:input={(e) => onChange({ nation: e.target.value })} />
    </div>
  </div>
</div>
