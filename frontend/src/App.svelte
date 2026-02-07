<script>
  import { onMount } from 'svelte';
  import NavBar from '$components/layout/NavBar.svelte';
  import AdvancedPage from '$routes/AdvancedPage.svelte';
  import EsotericPage from '$routes/EsotericPage.svelte';
  import EducationPage from '$routes/EducationPage.svelte';
  import HomePage from '$routes/HomePage.svelte';
  import { getTheme } from '$lib/theme';
  import { animatePageIn, animatePageOut } from '$lib/animations/pageTransitions';

  export let page = 'home';
  const routes = { home: HomePage, advanced: AdvancedPage, esoteric: EsotericPage, education: EducationPage };
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

  let isNavigating = false;

  const handleNavigate = async (event, href) => {
    if (!href) return;
    if (event) {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
    }
    if (isNavigating) return;
    isNavigating = true;
    await animatePageOut();
    window.location.href = href;
  };

  onMount(() => {
    animatePageIn();
    const onPageShow = (event) => {
      if (event.persisted) {
        animatePageIn();
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  });
</script>

<div class={`min-h-screen flex flex-col gap-4 ${theme.bgClass}`} style={themeVars} id="app-shell">
  <NavBar active={page} onNavigate={handleNavigate} />
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
