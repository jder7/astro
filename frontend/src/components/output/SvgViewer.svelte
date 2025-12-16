<script>
  import { copyToClipboard, downloadSvg } from '$lib/utils/download';

  export let svgMarkup = '';
  export let title = 'Chart preview';
  let copied = false;

  async function copySvg() {
    const ok = await copyToClipboard(svgMarkup || '');
    copied = ok;
    setTimeout(() => {
      copied = false;
    }, 1200);
  }
</script>

<div class="glass-card p-4 space-y-3" id="svg-viewer">
  <div class="flex items-center justify-between">
    <div>
      <p class="section-title text-xs">{title}</p>
      <p class="text-sm text-slate-300">SVG served from FastAPI.</p>
    </div>
    <div class="flex items-center gap-2">
      <button type="button" class="button-ghost" on:click={() => downloadSvg(svgMarkup)} disabled={!svgMarkup}>Download SVG</button>
      <button type="button" class="button-ghost" on:click={copySvg} disabled={!svgMarkup}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  </div>
  {#if svgMarkup}
    <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-3 max-h-[520px] overflow-auto">
      <div class="w-full flex justify-center">
        <div class="min-w-[320px]" aria-live="polite">
          {@html svgMarkup}
        </div>
      </div>
    </div>
  {:else}
    <p class="text-sm text-slate-400">Generate a chart to view the SVG.</p>
  {/if}
</div>
