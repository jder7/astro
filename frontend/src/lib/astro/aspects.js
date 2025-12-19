export const ASPECT_ICONS = {
  conjunction: '☌', //'◎' alternative
  opposition: '☍',
  square: '□',
  trine: '△',
  sextile: '⚹',
  quintile: '⬠',
  quincunx: '⚻',
};

export const aspectIcon = (name) => {
  const key = String(name || '').trim().toLowerCase();
  return ASPECT_ICONS[key] || '✦';
};

export const aspectColorClass = (name) => {
  const key = String(name || '').trim().toLowerCase();
  if (key === 'opposition' || key === 'square') return 'text-rose-400';
  return 'text-emerald-300';
};
