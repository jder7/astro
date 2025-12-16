<script>
  import PageIntro from '$components/layout/PageIntro.svelte';
  import HomeWorkbench from '$components/workbench/HomeWorkbench.svelte';
</script>

<PageIntro
  eyebrow="Astrology toolkit"
  title="Astro Home"
  description="Generate natal, transit, or dual-wheel charts with shared inputs and a tighter Svelte UI."
  badge="Home"
  page="home"
/>

<HomeWorkbench />
