<script>
  import { copyToClipboard } from '$lib/utils/download';

  export let report = null;
  let copied = false;
  let html = '';

  $: html =
    typeof report === 'string'
      ? report
          .split('\n')
          .filter(Boolean)
          .map((line) => `<p>${line}</p>`)
          .join('')
      : (report?.text || '')
          .split('\n')
          .filter(Boolean)
          .map((line) => `<p>${line}</p>`)
          .join('');

  async function copy() {
    if (!report) return;
    const text = typeof report === 'string' ? report : report.text || '';
    const ok = await copyToClipboard(text);
    copied = ok;
    setTimeout(() => (copied = false), 1200);
  }
</script>

{#if report}
  <div class="glass-card p-4 space-y-3" id="report-view">
    <div class="flex items-center justify-between">
      <div>
        <p class="section-title text-xs">Report</p>
        <p class="text-sm text-slate-300">{report.title || 'Generated markdown report'}</p>
      </div>
      <button class="button-ghost" type="button" on:click={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
    <div class="prose-report space-y-2 text-sm">
      {@html html}
    </div>
  </div>
{/if}
