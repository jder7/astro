export const POINT_ICONS = {
  sun: '☉',
  moon: '☾',
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  jupiter: '♃',
  saturn: '♄',
  uranus: '♅',
  neptune: '♆',
  pluto: '♇',
  chiron: '⚷',
  mean_lilith: '⚸',
  true_north_lunar_node: '☊',
  true_south_lunar_node: '☋',
  ascendant: '↗',
  descendant: '↘',
  medium_coeli: 'MC',
  imum_coeli: 'IC',
};

export const DAY_RULERS = {
  0: 'sun',
  1: 'moon',
  2: 'mars',
  3: 'mercury',
  4: 'jupiter',
  5: 'venus',
  6: 'saturn',
};

export const ELEMENT_ICON = {
  Fire: '🔥',
  Earth: '🌍',
  Air: '🌬️',
  Water: '💧',
};

export const QUALITY_ICON = {
  Cardinal: '⬆️',
  Fixed: '⏺️',
  Mutable: '🔁',
};

const FULL = {
  aries: '♈︎',
  taurus: '♉︎',
  gemini: '♊︎',
  cancer: '♋︎',
  leo: '♌︎',
  virgo: '♍︎',
  libra: '♎︎',
  scorpio: '♏︎',
  sagittarius: '♐︎',
  capricorn: '♑︎',
  aquarius: '♒︎',
  pisces: '♓︎',
};

const ABBREV = {
  ari: '♈︎',
  tau: '♉︎',
  gem: '♊︎',
  can: '♋︎',
  leo: '♌︎',
  vir: '♍︎',
  lib: '♎︎',
  sco: '♏︎',
  sag: '♐︎',
  cap: '♑︎',
  aqu: '♒︎',
  pis: '♓︎',
};

export const SIGN_SYMBOLS = { ...FULL, ...ABBREV };

export const signSymbol = (sign) => SIGN_SYMBOLS[String(sign || '').trim().toLowerCase()] || '';

const NAME_MAP = {
  aries: 'Aries',
  taurus: 'Taurus',
  gemini: 'Gemini',
  cancer: 'Cancer',
  leo: 'Leo',
  virgo: 'Virgo',
  libra: 'Libra',
  scorpio: 'Scorpio',
  sagittarius: 'Sagittarius',
  capricorn: 'Capricorn',
  aquarius: 'Aquarius',
  pisces: 'Pisces',
};

const NAME_FROM_ABBREV = {
  ari: 'Aries',
  tau: 'Taurus',
  gem: 'Gemini',
  can: 'Cancer',
  leo: 'Leo',
  vir: 'Virgo',
  lib: 'Libra',
  sco: 'Scorpio',
  sag: 'Sagittarius',
  cap: 'Capricorn',
  aqu: 'Aquarius',
  pis: 'Pisces',
};

export const signName = (sign) => {
  const clean = String(sign || '').trim().toLowerCase();
  if (NAME_MAP[clean]) return NAME_MAP[clean];
  if (NAME_FROM_ABBREV[clean]) return NAME_FROM_ABBREV[clean];
  return sign || '—';
};

export const signAbbrev = (sign) => {
  const clean = String(sign || '').trim();
  const lower = clean.toLowerCase();
  if (ABBREV[lower]) return clean.length <= 3 ? clean : clean.slice(0, 3);
  return clean ? clean.slice(0, 3) : '—';
};

export const POINT_SYMBOLS = POINT_ICONS;

export const ACTIVE_POINTS = [
  { key: 'sun', label: 'Sun', emoji: '☉' },
  { key: 'moon', label: 'Moon', emoji: '☾' },
  { key: 'mercury', label: 'Mercury', emoji: '☿' },
  { key: 'venus', label: 'Venus', emoji: '♀' },
  { key: 'mars', label: 'Mars', emoji: '♂' },
  { key: 'jupiter', label: 'Jupiter', emoji: '♃' },
  { key: 'saturn', label: 'Saturn', emoji: '♄' },
  { key: 'uranus', label: 'Uranus', emoji: '♅' },
  { key: 'neptune', label: 'Neptune', emoji: '♆' },
  { key: 'pluto', label: 'Pluto', emoji: '♇' },
  { key: 'chiron', label: 'Chiron', emoji: '⚷' },
  { key: 'mean_lilith', label: 'Lilith', emoji: '☾‵' },
  { key: 'true_north_lunar_node', label: 'North Node', emoji: '☊' },
  { key: 'true_south_lunar_node', label: 'South Node', emoji: '☋' },
  { key: 'ascendant', label: 'Ascendant', emoji: '↗' },
  { key: 'descendant', label: 'Descendant', emoji: '↘' },
  { key: 'medium_coeli', label: 'MC', emoji: '' },
  { key: 'imum_coeli', label: 'IC', emoji: '' },
];

export const DEFAULT_ACTIVE_KEYS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'ascendant'];
