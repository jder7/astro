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
    <p>
      New Svelte/Tailwind UI. Legacy static assets remain under
      <a href="/legacy/home.html" class="text-cyan-300 hover:text-cyan-100">/legacy</a>.
    </p>
  </footer>
</div>
