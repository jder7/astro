<script>
  import NavBar from '$components/layout/NavBar.svelte';
  import AdvancedPage from '$routes/AdvancedPage.svelte';
  import EsotericPage from '$routes/EsotericPage.svelte';
  import HomePage from '$routes/HomePage.svelte';
  import { getTheme } from '$lib/theme';

  export let page = 'home';
  const routes = { home: HomePage, advanced: AdvancedPage, esoteric: EsotericPage };
  $: Current = routes[page] || HomePage;
  $: theme = getTheme(page);
  $: themeVars = `
    --accent:${theme.accent};
    --accent-strong:${theme.accentStrong};
    --accent-soft:${theme.accentSoft};
    --badge-bg:${theme.badgeBg};
    --badge-border:${theme.badgeBorder};
    --badge-text:${theme.badgeText};
  `;
</script>

<div class={`min-h-screen flex flex-col gap-4 ${theme.bgClass}`} style={themeVars} id="app-shell">
  <NavBar active={page} />
  <main class="flex-1">
    <svelte:component this={Current} />
  </main>
  <footer class="page-shell pb-10 text-sm text-slate-500">
          <span>Astro App</span>
          <span>— powered by</span>
          <a href="https://www.kerykeion.net/" target="_blank" rel="noreferrer">
            Kerykeion
          </a>
          <span>and FastAPI.</span>
  </footer>
</div>
