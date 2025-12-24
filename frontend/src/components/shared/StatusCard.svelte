<script>
  export let id = '';
  export let label = 'Status';
  export let labelClass = 'section-title text-xs';
  export let statusText = '';
  export let statusClass = 'text-sm text-slate-200';
  export let errorMessage = '';
  export let errorClass = 'text-sm text-rose-300';
  export let loading = false;
  export let ready = false;
  export let loadingLabel = 'Working…';
  export let readyLabel = 'Ready';
</script>

<div id={id || undefined} class="flowbite-card space-y-3">
  <div class="card-head">
    <div>
      <p class={labelClass}>{label}</p>
      <p class={statusClass}>{statusText || 'Idle'}</p>
      {#if errorMessage}
        <p class={errorClass}>{errorMessage}</p>
      {/if}
    </div>
    <div class="card-head-actions">
      {#if loading}
        <span class="badge">{loadingLabel}</span>
      {:else if ready}
        <span class="badge">{readyLabel}</span>
      {/if}
    </div>
  </div>
</div>
