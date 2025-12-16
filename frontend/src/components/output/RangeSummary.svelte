<script>
  export let ranges = [];
</script>

{#if ranges && ranges.length}
  <div class="glass-card p-4 space-y-4" id="range-summary">
    <div class="flex items-center justify-between">
      <p class="section-title text-xs">Sweeps</p>
      <span class="badge">{ranges.length}</span>
    </div>
    <div class="space-y-3">
      {#each ranges as range}
        <div class="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
          <div class="flex items-center justify-between">
            <p class="font-semibold capitalize">{range.label}</p>
            <span class="badge">{range.entries?.length || 0} entries</span>
          </div>
          <div class="mt-2 space-y-1">
            {#each range.entries || [] as entry}
              <div class="flex items-center justify-between text-sm">
                <span>{entry.label || 'Segment'}</span>
                <span class="text-slate-400">{entry.start || '—'} → {entry.end || '—'}</span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
