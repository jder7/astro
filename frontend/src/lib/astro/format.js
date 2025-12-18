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

export function fallback(...values) {
  for (const val of values) {
    if (val === 0) return 0;
    if (val) return val;
  }
  return '';
}

export { formatDate, formatDateLabel, formatDateShort, formatDateTime, formatTime, toDate };
