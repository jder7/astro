<script>
  export let reportTitle = 'Detailed text';
  export let reportHtml = '';
  export let reportText = '';
  export let hasReport = false;
  export let loading = false;
  export let reportLoading = false;
  export let copied = false;
  export let onLoadReport = () => {};
  export let onDownloadPdf = () => {};
  export let onCopy = () => {};
</script>

<div class="flowbite-card space-y-4" id="report-card">
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Full report</p>
      <h2>{reportTitle}</h2>
    </div>
    <div class="flex items-center gap-2">
      <button class="button-ghost" type="button" on:click={onLoadReport} disabled={reportLoading || loading}>
        {reportLoading ? 'Loading…' : 'Load report'}
      </button>
      <button class="button-ghost" type="button" on:click={onDownloadPdf} disabled={reportLoading}>
        PDF
      </button>
    </div>
  </div>
  <div class="flex items-center justify-between gap-3">
    <p class="text-sm text-slate-400">Uses the same payload as the chart.</p>
    <div class="flex items-center gap-2">
      <button class="button-ghost" type="button" on:click={onCopy} disabled={!reportText}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      {#if hasReport}
        <span class="badge">Cached</span>
      {/if}
    </div>
  </div>
  <div class="border border-slate-800 rounded-2xl bg-slate-950/60 p-4 min-h-[140px]">
    {#if reportHtml}
      <div class="prose-report space-y-2 text-sm" aria-live="polite">
        {@html reportHtml}
      </div>
    {:else}
      <p class="text-sm text-slate-400">Click "Load report" to fetch the full text report for the current mode.</p>
    {/if}
  </div>
</div>
