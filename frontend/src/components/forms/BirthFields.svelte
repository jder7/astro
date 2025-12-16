<script>
  export let value = {};
  export let onChange = () => {};
  export let title = 'Birth';
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h3 class="section-title text-xs">{title}</h3>
    <span class="tag">Natal</span>
  </div>
  <div class="form-grid">
    <div class="full space-y-1.5">
      <label for="name">Name</label>
      <input id="name" name="name" type="text" value={value.name || ''} on:input={(e) => onChange({ name: e.target.value })} />
    </div>
    <div class="space-y-1.5">
      <label for="birthDate">Date</label>
      <input
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
    <div class="space-y-1.5">
      <label for="birthTime">Time</label>
      <input
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
    <div class="space-y-1.5">
      <label for="lat">Latitude</label>
      <input id="lat" name="lat" type="number" step="0.0001" value={value.lat} on:input={(e) => onChange({ lat: parseFloat(e.target.value) })} />
    </div>
    <div class="space-y-1.5">
      <label for="lng">Longitude</label>
      <input id="lng" name="lng" type="number" step="0.0001" value={value.lng} on:input={(e) => onChange({ lng: parseFloat(e.target.value) })} />
    </div>
    <div class="space-y-1.5">
      <label for="tz">Timezone</label>
      <input id="tz" name="tz" type="text" value={value.tz_str || ''} on:input={(e) => onChange({ tz_str: e.target.value })} />
    </div>
    <div class="space-y-1.5">
      <label for="city">City</label>
      <input id="city" name="city" type="text" value={value.city || ''} on:input={(e) => onChange({ city: e.target.value })} />
    </div>
    <div class="space-y-1.5">
      <label for="nation">Nation</label>
      <input id="nation" name="nation" type="text" value={value.nation || ''} on:input={(e) => onChange({ nation: e.target.value })} />
    </div>
  </div>
</div>
