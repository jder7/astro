export const QUALITY_MAP = {
  Cardinal: { label: 'Motion', className: 'eso-quality-motion' },
  Fixed: { label: 'Consciousness', className: 'eso-quality-consciousness' },
  Mutable: { label: 'Matter', className: 'eso-quality-matter' },
};

export const DECAN_META = {
  1: { label: 'Physical', uniqueKey: 'physical', className: 'eso-decan eso-decan-physical' },
  2: { label: 'Emotional', uniqueKey: 'emotional', className: 'eso-decan eso-decan-emotional' },
  3: { label: 'Mental', uniqueKey: 'mental', className: 'eso-decan eso-decan-mental' },
};

export const getDecanKeyForState = (state) =>
  Object.entries(DECAN_META).find(([, meta]) => meta?.uniqueKey === state)?.[0];

export const ELEMENT_PLANE_NUMBERS = {
  Air: 46,
  Fire: 47,
  Water: 48,
  Earth: 49,
};
