const UNITS = {
  en: { sec: 'sec', min: 'min', hr: 'hr' },
  so: { sec: 'ilbiriqsi', min: 'daqiiqo', hr: 'saac' },
};

export function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function longDuration(seconds, lang = 'en') {
  const u = UNITS[lang] ?? UNITS.en;
  const total = Math.floor(Number(seconds) || 0);
  if (total < 60) return `${total} ${u.sec}`;
  const mins = Math.round(total / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} ${u.hr} ${m} ${u.min}`;
  if (h) return `${h} ${u.hr}`;
  return `${m} ${u.min}`;
}

export function bytes(size) {
  const n = Number(size) || 0;
  if (n > 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n > 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  if (n > 1024) return `${Math.round(n / 1024)} KB`;
  return '0 MB';
}

export const initials = (name) =>
  (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
