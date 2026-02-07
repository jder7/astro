const THEMES = {
  home: {
    accent: '#06b6d4',
    accentStrong: '#0ea5e9',
    accentSoft: 'rgba(14,165,233,0.12)',
    badgeBg: 'rgba(14,165,233,0.12)',
    badgeBorder: 'rgba(14,165,233,0.4)',
    badgeText: '#c0e9ff',
    kicker: 'text-cyan-200/80',
    bgClass: 'page-home-bg',
  },
  advanced: {
    accent: '#f59e0b',
    accentStrong: '#d97706',
    accentSoft: 'rgba(245,158,11,0.12)',
    badgeBg: 'rgba(245,158,11,0.12)',
    badgeBorder: 'rgba(245,158,11,0.45)',
    badgeText: '#fde68a',
    kicker: 'text-amber-200/80',
    bgClass: 'page-advanced-bg',
  },
  esoteric: {
    accent: '#22c55e',
    accentStrong: '#16a34a',
    accentSoft: 'rgba(34,197,94,0.14)',
    badgeBg: 'rgba(34,197,94,0.14)',
    badgeBorder: 'rgba(34,197,94,0.45)',
    badgeText: '#bbf7d0',
    kicker: 'text-emerald-200/80',
    bgClass: 'page-esoteric-bg',
  },
  education: {
    accent: '#fbbf24',
    accentStrong: '#f97316',
    accentSoft: 'rgba(251,191,36,0.14)',
    badgeBg: 'rgba(251,191,36,0.16)',
    badgeBorder: 'rgba(249,115,22,0.45)',
    badgeText: '#fde68a',
    kicker: 'text-amber-200/80',
    bgClass: 'page-education-bg',
  },
};

export function getTheme(page = 'home') {
  return THEMES[page] || THEMES.home;
}
