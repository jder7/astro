<script>
  export let active = 'home';

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
  ];
</script>

<nav class="page-shell py-6 flex items-center justify-between gap-4" id="nav-bar">
  <div class="flex items-center gap-3">
    <div class="h-11 w-11 rounded-2xl bg-gradient-to-br from-cyan-500/80 via-indigo-500/60 to-emerald-400/80 flex items-center justify-center shadow-glow">
      <span class="font-display text-lg">✺</span>
    </div>
    <div>
      <p class="text-xs uppercase tracking-[0.25em] text-slate-400 font-semibold">Astrology Toolkit</p>
      <p class="font-display text-xl leading-tight">Astro</p>
    </div>
  </div>
  <div class="flex items-center gap-2">
    {#each links as link}
      <a
        class={`nav-link ${active === link.key ? 'active' : ''}`}
        href={link.href}
        aria-current={active === link.key ? 'page' : undefined}
      >
        {link.label}
      </a>
    {/each}
    <a class="nav-link" href="/legacy/home.html">Legacy</a>
  </div>
</nav>
