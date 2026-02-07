import { formatDate, formatDateLabel, formatDateShort, formatDateTime, formatTime, toDate } from './date';

const pad = (v) => String(v ?? 0).padStart(2, '0');

export function formatDegree(position) {
  if (!Number.isFinite(Number(position))) return '–';
  const num = Number(position);
  const degrees = Math.floor(num);
  const minutes = Math.round((num - degrees) * 60);
  const adjDeg = minutes === 60 ? degrees + 1 : degrees;
  const adjMin = minutes === 60 ? 0 : minutes;
  return `${adjDeg}°${pad(adjMin)}`;
}

export function formatDecimalDegree(position) {
  if (!Number.isFinite(Number(position))) return '—';
  return `${Number(position).toFixed(2)}°`;
}

export function ucfirst(value) {
  if (!value) return '';
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function formatOrdinal(value) {
  if (!Number.isFinite(Number(value))) return '';
  const num = Number(value);
  if (num === 1) return '1st';
  if (num === 2) return '2nd';
  if (num === 3) return '3rd';
  return `${num}th`;
}

export function fallback(...values) {
  for (const val of values) {
    if (val === 0) return 0;
    if (val) return val;
  }
  return '';
}

export function formatModeLabel(value) {
  if (!value) return '';
  if (value === 'natal_transit') return 'transit+natal';
  return String(value);
}

export function capitalise(str) {
  if (typeof str !== 'string' || str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export { formatDate, formatDateLabel, formatDateShort, formatDateTime, formatTime, toDate };
