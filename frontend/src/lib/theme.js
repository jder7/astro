const THEMES = {
  home: {
    accent: 'cyan',
    ring: 'focus:ring-cyan-500/70',
    badge: 'bg-cyan-500/10 border-cyan-500/40 text-cyan-100',
  },
  advanced: {
    accent: 'amber',
    ring: 'focus:ring-amber-500/70',
    badge: 'bg-amber-500/10 border-amber-500/40 text-amber-100',
  },
  esoteric: {
    accent: 'emerald',
    ring: 'focus:ring-emerald-500/70',
    badge: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-100',
  },
};

export function getTheme(page = 'home') {
  return THEMES[page] || THEMES.home;
}
