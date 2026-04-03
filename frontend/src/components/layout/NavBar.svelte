<script>
  export let active = 'home';
  export let onNavigate = null;
  export let pageTitle = '';
  export let pageDescription = '';
  let menuOpen = false;

  const isDev = import.meta.env.DEV;
  const hrefFor = (key) => {
    if (isDev) {
      if (key === 'home') return '/';
      return `/${key}.html`;
    }
    return key === 'home' ? '/home' : `/${key}`;
  };

  const links = [
    { href: hrefFor('home'), key: 'home', label: 'Home' },
    { href: hrefFor('advanced'), key: 'advanced', label: 'Advanced' },
    { href: hrefFor('esoteric'), key: 'esoteric', label: 'Esoteric' },
    { href: hrefFor('education'), key: 'education', label: 'Education' },
  ];
</script>

<nav class="page-shell nav-shell" id="nav-bar">
  <div class="nav-top">
    <div class="nav-brand">
      <div class="brand-mark">
        <span class="font-display text-3xl text-amber-300">✺</span>
      </div>
      <div>
        <p class="text-xs uppercase tracking-[0.25em] text-slate-400 font-semibold">Astrology Toolkit</p>
        <p class="font-display text-xl leading-tight">Astro</p>
      </div>
    </div>
    
    {#if pageTitle}
      <div class="page-info hidden lg:flex items-center gap-3 ml-auto mr-4">
        <div class="space-y-0.5">
          <h1 class="text-lg font-semibold text-slate-100">{pageTitle}</h1>
          {#if pageDescription}
            <p class="text-xs text-slate-400 max-w-md line-clamp-1">{pageDescription}</p>
          {/if}
        </div>
      </div>
    {/if}
    
    <button
      type="button"
      class="nav-toggle sm:hidden"
      aria-label="Toggle menu"
      aria-controls="nav-links"
      aria-expanded={menuOpen}
      on:click={() => (menuOpen = !menuOpen)}
    >
      <svg class="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d={menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 6h16M4 12h16M4 18h16'} />
      </svg>
    </button>
  </div>
  <div class={`nav-links ${menuOpen ? 'is-open' : ''}`} id="nav-links">
    {#each links as link}
      <a
        class={`nav-link ${active === link.key ? 'active' : ''}`}
        href={link.href}
        aria-current={active === link.key ? 'page' : undefined}
        on:click={(event) => {
          menuOpen = false;
          if (typeof onNavigate === 'function') {
            onNavigate(event, link.href);
          }
        }}
      >
        {link.label}
      </a>
    {/each}
  </div>
</nav>

<style>
  .page-info {
    flex-shrink: 0;
  }
  
  .line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
