<script>
  import { get } from 'svelte/store';
  import { requestReport, requestReportPdf } from '$lib/api/client';
  import { buildReportPayload } from '$lib/payloads';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import { setCacheEntry } from '$lib/state/cacheStore';
  import { marked } from 'marked';
  import { copyToClipboard, downloadBlob } from '$lib/utils/download';

  export let mode = 'natal';
  export let page = 'home';
  export let cachedReport = null;

  let reportMarkdown = cachedReport || '';
  let reportLoading = false;
  let copied = false;
  let localStatus = '';

  $: if (cachedReport && reportMarkdown !== cachedReport) {
    reportMarkdown = cachedReport;
  }

  $: reportTitle = 'Detailed text';
  $: hasReport = Boolean(reportMarkdown);
  $: reportHtml = typeof reportMarkdown === 'string' && reportMarkdown.trim() ? marked.parse(reportMarkdown) : '';

  async function generateReport() {
    reportLoading = true;
    localStatus = 'Generating report…';
    const state = get(inputStore);
    const cfg = get(configStore);
    try {
      const payload = buildReportPayload(mode, state, cfg);
      const resp = await requestReport(payload);
      console.info('[report] response', resp);
      reportMarkdown = typeof resp?.structured?.markdown === 'string' ? resp.structured.markdown : '';
      setCacheEntry(page, mode, 'report', { report: reportMarkdown });
      localStatus = 'Report ready.';
    } catch (err) {
      localStatus = err?.message || 'Failed to generate report.';
    } finally {
      reportLoading = false;
    }
  }

  async function downloadReportPdf() {
    reportLoading = true;
    localStatus = 'Preparing report PDF…';
    const state = get(inputStore);
    const cfg = get(configStore);
    try {
      const payload = buildReportPayload(mode, state, cfg);
      const blob = await requestReportPdf(payload);
      downloadBlob(blob, `${mode}-report.pdf`);
      localStatus = 'Report PDF downloaded.';
    } catch (err) {
      localStatus = err?.message || 'Failed to download report PDF.';
    } finally {
      reportLoading = false;
    }
  }

  async function copyReport() {
    if (!reportMarkdown) return;
    const ok = await copyToClipboard(reportMarkdown);
    copied = ok;
    setTimeout(() => (copied = false), 1200);
  }
</script>

<div class="flowbite-card space-y-4" id="report-card">
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Full report</p>
      <h2>{reportTitle}</h2>
    </div>
    <div class="flex items-center gap-2">
      <button class="button-ghost" type="button" on:click={generateReport} disabled={reportLoading}>
        {reportLoading ? 'Loading…' : 'Load report'}
      </button>
      <button class="button-ghost" type="button" on:click={downloadReportPdf} disabled={reportLoading}>
        <span aria-hidden="true">📄</span> PDF
      </button>
    </div>
  </div>
  <div class="flex items-center justify-between gap-3">
    <p class="text-sm text-slate-400">Uses the same payload as the chart.</p>
    <div class="flex items-center gap-2">
      <button class="button-ghost" type="button" on:click={copyReport} disabled={!reportMarkdown}>
        <span aria-hidden="true">📝</span>{copied ? 'Copied' : 'Copy'}
      </button>
      {#if hasReport}
        <span class="badge">Cached</span>
      {/if}
    </div>
  </div>
  {#if localStatus}
    <p class="text-xs text-slate-400">{localStatus}</p>
  {/if}
  <div class="border border-slate-800 rounded-2xl bg-slate-950/60 p-4 min-h-[140px]" id="report-markdown">
    {#if reportMarkdown}
      <div class="prose-report space-y-2 text-sm" aria-live="polite">
        {@html reportHtml}
      </div>
    {:else}
      <p class="text-sm text-slate-400">Click "Load report" to fetch the full text report for the current mode.</p>
    {/if}
  </div>
</div>
