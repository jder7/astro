<script>
  import PageIntro from '$components/layout/PageIntro.svelte';
  import ChartWorkbench from '$components/workbench/ChartWorkbench.svelte';
</script>

<PageIntro
  eyebrow="Deep dive"
  title="Advanced Workbench"
  description="Pro controls for range sweeps, reusable inputs, and richer summaries for ascendant and lunar cycles."
  badge="Advanced"
  page="advanced"
/>

<ChartWorkbench page="advanced" showRange={true} enableReport={true} />
