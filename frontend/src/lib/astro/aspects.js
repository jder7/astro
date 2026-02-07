export const ASPECT_ICONS = {
  conjunction: '☌', //'◎' alternative
  opposition: '☍',
  square: '□',
  trine: '△',
  sextile: '⚹',
  quintile: '⬠',
  biquintile: '⬟',
  quincunx: '⚻',
  semisextile: '⚺',
  semisquare: '∠',
  sesquiquadrate: '⚼',
  septile: '✶',
  novile: '✷',
};

export const ASPECT_COLOR_CLASSES = {
  opposition: 'text-rose-400',
  square: 'text-rose-400',
  semisquare: 'text-rose-400',
  sesquiquadrate: 'text-rose-400',
  quincunx: 'text-rose-400',
  conjunction: 'text-emerald-300',
  trine: 'text-emerald-300',
  sextile: 'text-emerald-300',
  quintile: 'text-emerald-300',
  biquintile: 'text-emerald-300',
  semisextile: 'text-emerald-300',
  septile: 'text-emerald-300',
  novile: 'text-emerald-300',
  default: 'text-slate-300',
};

export const ASPECT_MULTIPLIERS = {
  conjunction: 4,
  trine: 3,
  sextile: 2,
  quintile: 2,
  biquintile: 1.5,
  semisextile: 1.5,
  septile: 1.5,
  novile: 1.5,
  opposition: 0.3,
  square: 0.5,
  semisquare: 0.7,
  sesquiquadrate: 0.7,
  quincunx: 0.5,
  default: 1,
};

export const aspectIcon = (name) => {
  const key = String(name || '').trim().toLowerCase();
  return ASPECT_ICONS[key] || '✦';
};

export const aspectColorClass = (name) => {
  const key = String(name || '').trim().toLowerCase();
  return ASPECT_COLOR_CLASSES[key] || ASPECT_COLOR_CLASSES.default;
};

export const aspectMultiplier = (name) => {
  const key = String(name || '').trim().toLowerCase();
  return ASPECT_MULTIPLIERS[key] ?? ASPECT_MULTIPLIERS.default;
};

export const buildAspectIdentifier = ({ leftIcon = '✦', rightIcon = '✦', aspectName = '' } = {}) =>
  `${leftIcon} ${aspectIcon(aspectName)} ${rightIcon}`.trim();
