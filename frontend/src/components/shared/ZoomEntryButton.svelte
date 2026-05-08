<script>
  export let id = undefined;
  export let disabled = false;
  export let title = '';
  export let ariaLabel = '';
  export let className = '';
  export let alignEnd = false;
  export let onClick = () => {};

  $: label = ariaLabel || 'Zoom';
  $: buttonTitle = title || label;
</script>

<button
  {id}
  type="button"
  class={`zoom-entry-button ${className}`.trim()}
  on:click={onClick}
  {disabled}
  aria-label={label}
  title={buttonTitle}
  class:zoom-entry-button--align-end={alignEnd}
>
  <span aria-hidden="true">⛶</span>
</button>

<style>
  .zoom-entry-button {
    min-height: 34px;
    padding: 5px 10px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--accent, #06b6d4) 18%, #1e293b 82%);
    background: color-mix(in srgb, var(--accent-soft, rgba(14, 165, 233, 0.12)) 24%, rgba(15, 23, 42, 0.68));
    color: color-mix(in srgb, var(--accent, #06b6d4) 18%, #e2e8f0 82%);
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .zoom-entry-button:hover:not(:disabled) {
    color: #f8fafc;
    border-color: color-mix(in srgb, var(--accent, #06b6d4) 45%, #334155 55%);
    background: var(--accent-soft, rgba(14, 165, 233, 0.12));
  }

  .zoom-entry-button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent, #06b6d4);
  }

  .zoom-entry-button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .zoom-entry-button--align-end {
    margin-left: auto;
  }
</style>
