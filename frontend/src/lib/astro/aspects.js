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

// Hex colors for SVG rendering (matching Tailwind classes)
export const ASPECT_HEX_COLORS = {
  opposition: '#fb7185',   // rose-400
  square: '#fb7185',
  semisquare: '#fb7185',
  sesquiquadrate: '#fb7185',
  quincunx: '#fb7185',
  conjunction: '#6ee7b7',  // emerald-300
  trine: '#6ee7b7',
  sextile: '#6ee7b7',
  quintile: '#6ee7b7',
  biquintile: '#6ee7b7',
  semisextile: '#6ee7b7',
  septile: '#6ee7b7',
  novile: '#6ee7b7',
  default: '#cbd5e1',      // slate-300
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

export const aspectHexColor = (name) => {
  const key = String(name || '').trim().toLowerCase();
  return ASPECT_HEX_COLORS[key] || ASPECT_HEX_COLORS.default;
};

export const aspectMultiplier = (name) => {
  const key = String(name || '').trim().toLowerCase();
  return ASPECT_MULTIPLIERS[key] ?? ASPECT_MULTIPLIERS.default;
};

export const buildAspectIdentifier = ({ leftIcon = '✦', rightIcon = '✦', aspectName = '' } = {}) =>
  `${leftIcon} ${aspectIcon(aspectName)} ${rightIcon}`.trim();
