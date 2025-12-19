import { ELEMENT_ICON, POINT_SYMBOLS } from './signs';

const ELEMENT_GRADIENTS = {
  Fire: ['#fb7185', '#f97316'],
  Earth: ['#afebb4ff', '#a16207'],
  Air: ['#7dd3fc', '#22c55e'],
  Water: ['#7dd3fc', '#1519fbff'],
  Default: ['#94a3b8', '#fa10faff'],
};

const SPECIAL_GRADIENTS = {
  silver: ['#ff94e3ff', '#cbd5e1'],
  brightGold: ['#fef08a', '#f59e0b'],
  silverViolet: ['#e2e8f0', '#a78bfa'],
  goldViolet: ['#facc15', '#b194f4ff'],
  violetLila: ['#850cf6ff', '#c084fc'],
};

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const gradientForElement = (element, fallback) => {
  if (element && ELEMENT_GRADIENTS[element]) return ELEMENT_GRADIENTS[element];
  if (fallback && SPECIAL_GRADIENTS[fallback]) return SPECIAL_GRADIENTS[fallback];
  return ELEMENT_GRADIENTS.Default;
};

const buildBasePetal = (safeSize, center) => {
  const tipY = center - safeSize * 0.42;
  const controlUp = center - safeSize * 0.12;
  const spread = safeSize * 0.28;
  const flareY = center + safeSize * 0.18;
  return [
    `M ${center} ${center}`,
    `C ${center - spread} ${controlUp}, ${center - spread * 0.5} ${flareY}, ${center} ${tipY}`,
    `C ${center + spread * 0.5} ${flareY}, ${center + spread} ${controlUp}, ${center} ${center}`,
    'Z',
  ].join(' ');
};

const tallyElements = (...elements) => {
  const counts = {};
  elements.forEach((el) => {
    if (!el) return;
    counts[el] = (counts[el] || 0) + 1;
  });
  return counts;
};

export class ElementSigilShape {
  constructor(options = {}) {
    this.generatedId = options.id || `sigil-${Math.random().toString(36).slice(2, 8)}`;
    this.setOptions(options);
  }

  setOptions(options = {}) {
    this.sunElement = options.sunElement || '';
    this.moonElement = options.moonElement || '';
    this.dayElement = options.dayElement || '';
    this.ascElement = options.ascElement || '';
    this.dayRulerKey = options.dayRulerKey || '';
    this.size = options.size;
    this.uid = options.id || this.generatedId;
    return this;
  }

  build() {
    const safeSize = Number.isFinite(Number(this.size)) ? Number(this.size) : 72;
    const center = safeSize / 2;

    const tally = tallyElements(this.sunElement, this.moonElement, this.dayElement, this.ascElement);
    const hasDuplicate = Object.values(tally).some((count) => count > 1);

    const petalStops = {
      sun: gradientForElement(this.sunElement),
      moon: gradientForElement(this.moonElement, 'silverViolet'),
      day: gradientForElement(this.dayElement, 'goldViolet'),
      asc: gradientForElement(this.ascElement, 'violetLila'),
      spirit: hasDuplicate ? SPECIAL_GRADIENTS.silver : SPECIAL_GRADIENTS.brightGold,
    };

    const gradients = [
      { id: `${this.uid}-p1`, stops: petalStops.spirit },
      { id: `${this.uid}-p2`, stops: petalStops.asc },
      { id: `${this.uid}-p3`, stops: petalStops.day },
      { id: `${this.uid}-p4`, stops: petalStops.moon },
      { id: `${this.uid}-p5`, stops: petalStops.sun },
    ];

    const isGoldPetal = !hasDuplicate;
    const centerRadius = isGoldPetal ? safeSize * 0.14 : safeSize * 0.11;
    const centerStrokeWidth = isGoldPetal ? safeSize * 0.05 : safeSize * 0.015;

    const basePetal = buildBasePetal(safeSize, center);
    const rotationOffset = 90;
    const dayRulerKeyNorm = normalizeKey(this.dayRulerKey);
    const dayRulerIcon = POINT_SYMBOLS[dayRulerKeyNorm] || '☉';

    const angles = [
      { angle: -90, grad: gradients[0].id, icon: '☸' },
      {
        angle: -90 + 72,
        grad: gradients[1].id,
        icon: ELEMENT_ICON[this.ascElement] || POINT_SYMBOLS.ascendant || '↗',
      },
      {
        angle: -90 + 144,
        grad: gradients[2].id,
        icon: ELEMENT_ICON[this.dayElement] || POINT_SYMBOLS[dayRulerKeyNorm] || '★',
      },
      { angle: -90 + 216, grad: gradients[3].id, icon: ELEMENT_ICON[this.moonElement] || '☾' },
      { angle: -90 + 288, grad: gradients[4].id, icon: ELEMENT_ICON[this.sunElement] || '☉' },
    ];

    return {
      uid: this.uid,
      safeSize,
      center,
      gradients,
      angles,
      basePetal,
      rotationOffset,
      isGoldPetal,
      centerRadius,
      centerStrokeWidth,
      dayRulerIcon,
    };
  }
}

export const buildElementSigilShape = (options = {}) => new ElementSigilShape(options).build();

export { ELEMENT_GRADIENTS, SPECIAL_GRADIENTS };
