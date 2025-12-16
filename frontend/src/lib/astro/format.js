const pad = (v) => String(v ?? 0).padStart(2, '0');

export function formatDate(parts) {
  if (!parts) return '';
  const { year, month, day } = parts;
  if (![year, month, day].every((n) => Number.isFinite(Number(n)))) return '';
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function formatTime(parts) {
  if (!parts) return '';
  const { hour = 0, minute = 0 } = parts;
  return `${pad(hour)}:${pad(minute)}`;
}

export function formatDateTime(parts) {
  const date = formatDate(parts);
  const time = formatTime(parts);
  return `${date}${time ? ` ${time}` : ''}`.trim();
}

export function formatDegree(position) {
  if (!Number.isFinite(Number(position))) return '–';
  const num = Number(position);
  const degrees = Math.floor(num);
  const minutes = Math.round((num - degrees) * 60);
  const adjDeg = minutes === 60 ? degrees + 1 : degrees;
  const adjMin = minutes === 60 ? 0 : minutes;
  return `${adjDeg}°${pad(adjMin)}`;
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
