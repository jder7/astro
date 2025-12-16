<script>
  import { copyToClipboard } from '$lib/utils/download';

  export let data = null;
  export let title = 'API response';
  let copied = false;

  const pretty = () => (data ? JSON.stringify(data, null, 2) : 'No response yet.');

  async function copy() {
    const ok = await copyToClipboard(pretty());
    copied = ok;
    setTimeout(() => (copied = false), 1200);
  }
</script>

<div class="glass-card p-4 space-y-3" id="api-response-view">
  <div class="flex items-center justify-between">
    <p class="section-title text-xs">{title}</p>
    <button type="button" class="button-ghost" on:click={copy} disabled={!data}>{copied ? 'Copied' : 'Copy'}</button>
  </div>
  <pre class="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 overflow-auto max-h-[320px]">
{pretty()}
  </pre>
</div>
