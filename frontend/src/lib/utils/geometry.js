/**
 * Geometry utilities for SVG chart rendering
 */

/**
 * Normalize angle to 0-360 range
 */
export const normalizeAngle = (deg) => {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
};

/**
 * Convert degrees to radians
 */
export const degToRad = (deg) => (deg * Math.PI) / 180;

/**
 * Convert polar coordinates to Cartesian (SVG coordinate system)
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} radius - Distance from center
 * @param {number} angleDeg - Angle in degrees (0 = top, clockwise)
 */
export const polarToCartesian = (cx, cy, radius, angleDeg) => {
  const rad = degToRad(angleDeg - 90);
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
};

/**
 * Create SVG arc path (clockwise from start to end)
 */
export const describeArc = (cx, cy, radius, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  // Calculate clockwise sweep from start to end
  let sweep = endAngle - startAngle;
  if (sweep < 0) sweep += 360;
  const largeArcFlag = sweep > 180 ? 1 : 0;
  // sweep-flag = 1 means clockwise
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

/**
 * Create SVG arc path for counterclockwise direction (for zodiac signs)
 * This draws from startAngle counterclockwise to endAngle
 */
export const describeArcCCW = (cx, cy, radius, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  // Calculate counterclockwise sweep from start to end
  let sweep = startAngle - endAngle;
  if (sweep < 0) sweep += 360;
  const largeArcFlag = sweep > 180 ? 1 : 0;
  // sweep-flag = 0 means counterclockwise
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

/**
 * Convert absolute longitude to chart angle
 * ASC is at 270° (9 o'clock position), counterclockwise orientation
 * SVG coordinates: 0°=top, 90°=right, 180°=bottom, 270°=left
 * @param {number} longitude - Absolute longitude (0-360)
 * @param {number} ascLongitude - Ascendant longitude
 */
export const longitudeToChartAngle = (longitude, ascLongitude) => {
  return normalizeAngle(270 - (longitude - ascLongitude));
};

/**
 * Calculate angular distance between two angles
 */
export const angularDistance = (a, b) => {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b)) % 360;
  return diff > 180 ? 360 - diff : diff;
};

/**
 * Normalize point key to standard format
 */
export const normalizePointKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
