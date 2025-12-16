<script>
  import PageIntro from '$components/layout/PageIntro.svelte';
  import ChartWorkbench from '$components/workbench/ChartWorkbench.svelte';
</script>

<PageIntro
  eyebrow="Esoteric lab"
  title="Esoteric overlays"
  description="Experiment with heliocentric, draconic, and karmic overlays while keeping the same shared input shell."
  badge="Esoteric"
  page="esoteric"
/>

<ChartWorkbench page="esoteric" showRange={false} enableReport={true} />
