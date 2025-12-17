<script>
  import SvgViewer from '$components/output/SvgViewer.svelte';

  export let svgMarkup = '';
</script>

<div class="flowbite-card space-y-3">
  <div class="flex items-center justify-between">
    <p class="section-title text-xs">SVG output</p>
    {#if svgMarkup}
      <span class="badge">Live render</span>
    {/if}
  </div>
  <SvgViewer {svgMarkup} />
</div>
