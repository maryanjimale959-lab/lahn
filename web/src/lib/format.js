import { arabicDigits } from './i18n.js';

export function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function longDuration(seconds, lang = 'en') {
  const total = Math.floor(Number(seconds) || 0);
  const num = (v) => (lang === 'en' ? String(v) : arabicDigits(String(v)).replace('.', '٫'));
  if (total < 60) return lang === 'ar' ? `${num(total)} ثانية` : `${num(total)} sec`;
  const mins = Math.round(total / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (lang === 'ar') {
    if (h && m) return `${num(h)} س ${num(m)} د`;
    if (h) return `${num(h)} س`;
    return `${num(m)} د`;
  }
  if (h && m) return `${num(h)} hr ${num(m)} min`;
  if (h) return `${num(h)} hr`;
  return `${num(m)} min`;
}

export function bytes(size, lang = 'en') {
  const n = Number(size) || 0;
  const num = (v) => (lang === 'en' ? String(v) : arabicDigits(String(v)).replace('.', '٫'));
  if (n > 1024 ** 3) return `${num((n / 1024 ** 3).toFixed(1))} GB`;
  if (n > 1024 ** 2) return `${num(Math.round(n / 1024 ** 2))} MB`;
  if (n > 1024) return `${num(Math.round(n / 1024))} KB`;
  return `${num(0)} MB`;
}

export const initials = (name) =>
  (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
