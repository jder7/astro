<script>
  export let aspects = [];
</script>

<div class="glass-card p-4 space-y-3" id="aspects-list">
  <div class="flex items-center justify-between">
    <p class="section-title text-xs">Aspects</p>
    <span class="badge">{aspects.length}</span>
  </div>
  {#if aspects.length === 0}
    <p class="text-sm text-slate-400">No aspects available.</p>
  {:else}
    <ul class="space-y-2">
      {#each aspects as aspect}
        <li class="border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between">
          <div>
            <p class="font-semibold">{aspect.name}</p>
            <p class="text-xs text-slate-400">{aspect.left || '…'} ↔ {aspect.right || '…'}</p>
          </div>
          {#if aspect.orb}
            <span class="badge">{aspect.orb}°</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
