<script>
  export let status = '';
  export let errorMessage = '';
  export let loading = false;
  export let ready = false;
  export let title = 'Status';
</script>

<div class="flowbite-card flex items-center justify-between">
  <div>
    <p class="section-title text-xs">{title}</p>
    <p class="text-sm text-slate-200">{status || 'Idle'}</p>
    {#if errorMessage}
      <p class="text-sm text-rose-300">{errorMessage}</p>
    {/if}
  </div>
  {#if loading}
    <span class="badge">Working…</span>
  {:else if ready}
    <span class="badge">Ready</span>
  {/if}
</div>
