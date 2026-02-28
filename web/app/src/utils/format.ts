export function formatDurationFromSeconds(seconds?: number | null, fallback = ''): string {
  if (seconds == null || seconds < 0 || !Number.isFinite(seconds)) return fallback;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatShortPlayCount(count?: number | null): string {
  if (count == null || !Number.isFinite(count) || count <= 0) return '0';
  const value = Math.floor(count);
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(value);
}
