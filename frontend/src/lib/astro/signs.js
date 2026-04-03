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
  Earth: '⛰️',
  Air: '💨',
  Water: '💧',
  Default: '✨'
};

export const QUALITY_ICON = {
  Cardinal: '⬆️',
  Fixed: '⏺️',
  Mutable: '🔁',
};

export const ELEMENT_HEX = {
  Fire: '#fb7185',
  Earth: '#eab308',
  Air: '#34d399',
  Water: '#60a5fa',
  Default: '#94a3b8',
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

// Sign to element mapping
export const SIGN_ELEMENTS = {
  aries: 'Fire', ari: 'Fire',
  taurus: 'Earth', tau: 'Earth',
  gemini: 'Air', gem: 'Air',
  cancer: 'Water', can: 'Water',
  leo: 'Fire',
  virgo: 'Earth', vir: 'Earth',
  libra: 'Air', lib: 'Air',
  scorpio: 'Water', sco: 'Water',
  sagittarius: 'Fire', sag: 'Fire',
  capricorn: 'Earth', cap: 'Earth',
  aquarius: 'Air', aqu: 'Air',
  pisces: 'Water', pis: 'Water',
};

export const signElement = (sign) => {
  const clean = String(sign || '').trim().toLowerCase();
  return SIGN_ELEMENTS[clean] || 'Default';
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

const HOUSE_NAMES = {
  house_1: 'First House',
  house_2: 'Second House',
  house_3: 'Third House',
  house_4: 'Fourth House',
  house_5: 'Fifth House',
  house_6: 'Sixth House',
  house_7: 'Seventh House',
  house_8: 'Eighth House',
  house_9: 'Ninth House',
  house_10: 'Tenth House',
  house_11: 'Eleventh House',
  house_12: 'Twelfth House',
  first_house: 'First House',
  second_house: 'Second House',
  third_house: 'Third House',
  fourth_house: 'Fourth House',
  fifth_house: 'Fifth House',
  sixth_house: 'Sixth House',
  seventh_house: 'Seventh House',
  eighth_house: 'Eighth House',
  ninth_house: 'Ninth House',
  tenth_house: 'Tenth House',
  eleventh_house: 'Eleventh House',
  twelfth_house: 'Twelfth House',
};

const HOUSE_ROMAN = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'IX',
  10: 'X',
  11: 'XI',
  12: 'XII',
};

const normalizeHouseKey = (value) => String(value || '').trim().toLowerCase();

export const houseLabel = (houseKey) => {
  const key = normalizeHouseKey(houseKey);
  if (!key) return 'House';
  if (HOUSE_NAMES[key]) return HOUSE_NAMES[key];
  const match = key.match(/(\d+)/);
  if (match) {
    const num = Number(match[1]);
    if (HOUSE_ROMAN[num]) return `${HOUSE_ROMAN[num]} House`;
  }
  return houseKey || 'House';
};

export const houseRoman = (houseKeyOrNum) => {
  const num = Number(houseKeyOrNum);
  if (Number.isFinite(num) && HOUSE_ROMAN[num]) return HOUSE_ROMAN[num];
  const match = normalizeHouseKey(houseKeyOrNum).match(/(\d+)/);
  if (match && HOUSE_ROMAN[Number(match[1])]) return HOUSE_ROMAN[Number(match[1])];
  return '';
};
