<script>
  export let state = 'idle';
  export let title = 'Copy details';
  export let disabled = false;
  export let size = 'sm';
  export let className = '';
  export let onClick = () => {};
</script>

<button
  type="button"
  class={`aspect-copy-button aspect-copy-button--${size} ${className}`.trim()}
  on:click={onClick}
  {disabled}
  aria-label={title}
  title={title}
>
  {#if state === 'copied'}
    <span aria-hidden="true">✓</span>
  {:else if state === 'error'}
    <span aria-hidden="true">!</span>
  {:else}
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H10V7h9v14Z"
        fill="currentColor"
      ></path>
    </svg>
  {/if}
</button>

<style>
  .aspect-copy-button {
    border: 1px solid rgba(56, 189, 248, 0.45);
    background: rgba(8, 47, 73, 0.45);
    color: #bae6fd;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s, color 0.15s, box-shadow 0.15s;
  }

  .aspect-copy-button--sm {
    width: 28px;
    height: 28px;
    font-size: 0.8rem;
  }

  .aspect-copy-button--md {
    width: 32px;
    height: 32px;
    font-size: 0.85rem;
  }

  .aspect-copy-button:hover:not(:disabled) {
    border-color: rgba(56, 189, 248, 0.8);
    background: rgba(8, 47, 73, 0.7);
    color: #e0f2fe;
  }

  .aspect-copy-button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.45);
  }

  .aspect-copy-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .aspect-copy-button svg {
    width: 14px;
    height: 14px;
  }

  .aspect-copy-button--md svg {
    width: 15px;
    height: 15px;
  }
</style>
