<script>
  export let enablePointRays = false;
  export let overtoneCoeff = 0.2;
  export let dayRulerWeight = 3;
  export let sunPointWeight = 5;
  export let moonPointWeight = 3;
  export let ascendantPointWeight = 7;
  export let aspectWeightTight = 1;
  export let aspectWeightClose = 0.75;
  export let aspectWeightWide = 0.5;
  export let aspectWeightLoose = 0.3;

  const toNumber = (event) => {
    const value = Number.parseFloat(event?.target?.value);
    return Number.isFinite(value) ? value : 0;
  };
</script>

<div id="eso-ray-config" class="eso-ray-config">
  <div class="eso-config-section">
    <p class="eso-config-title">Point rays</p>
    <label class="eso-config-toggle">
      <input type="checkbox" bind:checked={enablePointRays} />
      <span>Enable planets rays</span>
    </label>
    <div class="eso-config-grid">
      <div class="eso-config-row">
        <label class="eso-config-label" for="eso-overtone">Point overtone</label>
        <input
          id="eso-overtone"
          class="eso-config-range"
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          value={overtoneCoeff}
          disabled={!enablePointRays}
          on:input={(event) => (overtoneCoeff = toNumber(event))}
        />
        <span class="eso-config-value">{overtoneCoeff.toFixed(1)}</span>
      </div>
    </div>
  </div>

  <div class="eso-config-section">
    <p class="eso-config-title">Weights</p>
    <div class="eso-config-grid">
      <div class="eso-config-row">
        <label class="eso-config-label" for="eso-day-ruler">Day ruler</label>
        <input
          id="eso-day-ruler"
          class="eso-config-range"
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          value={dayRulerWeight}
          on:input={(event) => (dayRulerWeight = toNumber(event))}
        />
        <span class="eso-config-value">{dayRulerWeight.toFixed(1)}</span>
      </div>
      <div class="eso-config-row">
        <label class="eso-config-label" for="eso-sun-weight">Sun point</label>
        <input
          id="eso-sun-weight"
          class="eso-config-range"
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          value={sunPointWeight}
          on:input={(event) => (sunPointWeight = toNumber(event))}
        />
        <span class="eso-config-value">{sunPointWeight.toFixed(1)}</span>
      </div>
      <div class="eso-config-row">
        <label class="eso-config-label" for="eso-moon-weight">Moon point</label>
        <input
          id="eso-moon-weight"
          class="eso-config-range"
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          value={moonPointWeight}
          on:input={(event) => (moonPointWeight = toNumber(event))}
        />
        <span class="eso-config-value">{moonPointWeight.toFixed(1)}</span>
      </div>
      <div class="eso-config-row">
        <label class="eso-config-label" for="eso-asc-weight">Ascendant</label>
        <input
          id="eso-asc-weight"
          class="eso-config-range"
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          value={ascendantPointWeight}
          on:input={(event) => (ascendantPointWeight = toNumber(event))}
        />
        <span class="eso-config-value">{ascendantPointWeight.toFixed(1)}</span>
      </div>
    </div>
  </div>

  <div class="eso-config-section">
    <p class="eso-config-title">Aspect orb weights</p>
    <div class="eso-config-grid">
      <div class="eso-config-row">
        <label class="eso-config-label" for="eso-orb-tight">Orb &lt; 1°</label>
        <input
          id="eso-orb-tight"
          class="eso-config-range"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={aspectWeightTight}
          on:input={(event) => (aspectWeightTight = toNumber(event))}
        />
        <span class="eso-config-value">{aspectWeightTight.toFixed(2)}</span>
      </div>
      <div class="eso-config-row">
        <label class="eso-config-label" for="eso-orb-close">Orb &lt; 3°</label>
        <input
          id="eso-orb-close"
          class="eso-config-range"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={aspectWeightClose}
          on:input={(event) => (aspectWeightClose = toNumber(event))}
        />
        <span class="eso-config-value">{aspectWeightClose.toFixed(2)}</span>
      </div>
      <div class="eso-config-row">
        <label class="eso-config-label" for="eso-orb-wide">Orb &lt; 5°</label>
        <input
          id="eso-orb-wide"
          class="eso-config-range"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={aspectWeightWide}
          on:input={(event) => (aspectWeightWide = toNumber(event))}
        />
        <span class="eso-config-value">{aspectWeightWide.toFixed(2)}</span>
      </div>
      <div class="eso-config-row">
        <label class="eso-config-label" for="eso-orb-loose">Orb &lt; 10°</label>
        <input
          id="eso-orb-loose"
          class="eso-config-range"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={aspectWeightLoose}
          on:input={(event) => (aspectWeightLoose = toNumber(event))}
        />
        <span class="eso-config-value">{aspectWeightLoose.toFixed(2)}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .eso-ray-config {
    border: 1px solid rgba(20, 83, 45, 0.55);
    border-radius: 14px;
    background: rgba(7, 28, 19, 0.6);
    padding: 0.8rem;
    display: grid;
    gap: 0.85rem;
  }

  .eso-config-grid {
    display: grid;
    gap: 0.6rem;
  }

  .eso-config-section {
    display: grid;
    gap: 0.6rem;
  }

  .eso-config-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-weight: 700;
    color: rgba(167, 243, 208, 0.8);
  }

  .eso-config-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.3rem 0.6rem;
    align-items: center;
  }

  .eso-config-label {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: none;
    color: rgba(226, 253, 244, 0.9);
    grid-column: 1 / -1;
  }

  .eso-config-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    letter-spacing: 0.02em;
    text-transform: none;
    color: rgba(226, 253, 244, 0.9);
  }

  .eso-config-toggle input {
    accent-color: #22c55e;
  }

  .eso-config-range {
    width: 100%;
    accent-color: #22c55e;
  }

  .eso-config-value {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(167, 243, 208, 0.85);
    text-align: right;
    min-width: 3ch;
  }

  .eso-config-row input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .eso-config-row {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .eso-config-value {
      text-align: left;
    }
  }

  @media (min-width: 900px) {
    .eso-config-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
