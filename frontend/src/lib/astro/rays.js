const RAY_COLORS = {
  1: 'Red',
  2: 'Navy/Indigo',
  3: 'Green',
  4: 'Yellow',
  5: 'Orange',
  6: 'Aqua Blue',
  7: 'Violet',
};

const RAY_COLOR_HEX = {
  1: '#ef4444',
  2: '#1e3a8a',
  3: '#22c55e',
  4: '#facc15',
  5: '#fb923c',
  6: '#22d3ee',
  7: '#a78bfa',
};

export const RAYS = [1, 2, 3, 4, 5, 6, 7];

const SIGN_RAYS = {
  aries: [1, 7],
  taurus: [4],
  gemini: [2],
  cancer: [3, 7],
  leo: [1, 5],
  virgo: [2, 7],
  libra: [3],
  scorpio: [4],
  sagittarius: [4, 5, 6],
  capricorn: [1, 3, 7],
  aquarius: [5],
  pisces: [2, 6],
};

const SIGN_ESSENTIAL_QUALITY = {
  aries: 'Trust in life',
  taurus: 'Trust in self',
  gemini: 'Obedience to law',
  cancer: 'Uprightness',
  leo: 'Impersonality',
  virgo: 'Willingness to sacrifice',
  libra: 'Faithfulness',
  scorpio: 'Reticence',
  sagittarius: 'Joy in life',
  capricorn: 'Purposefulness',
  aquarius: 'Wisdom',
  pisces: 'Unity',
};

const SIGN_SYMBOL_TO_KEY = {
  '♈': 'aries',
  '♉': 'taurus',
  '♊': 'gemini',
  '♋': 'cancer',
  '♌': 'leo',
  '♍': 'virgo',
  '♎': 'libra',
  '♏': 'scorpio',
  '♐': 'sagittarius',
  '♑': 'capricorn',
  '♒': 'aquarius',
  '♓': 'pisces',
};

const normalizeSignKey = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/\ufe0e|\ufe0f/g, '');
  if (SIGN_SYMBOL_TO_KEY[cleaned]) return SIGN_SYMBOL_TO_KEY[cleaned];
  return cleaned.toLowerCase();
};

export const getSignRays = (sign) => {
  const key = normalizeSignKey(sign);
  return SIGN_RAYS[key] || [];
};

export const getRayColorHex = (ray) => RAY_COLOR_HEX[ray] || '#94a3b8';

export const getRayColorName = (ray) => RAY_COLORS[ray] || 'Neutral';

export const getSignEssentialQuality = (sign) => {
  const key = normalizeSignKey(sign);
  return SIGN_ESSENTIAL_QUALITY[key] || '';
};
