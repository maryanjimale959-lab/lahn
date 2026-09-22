const cache = new Map();

export function hashHue(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/* Laxan's whole family is the logo's — rose through amber. Cover art is read for its brightness
   and contrast, but its hue is folded into that arc, so a blue poster still yields a warm tile
   rather than a colour that belongs to another brand. */
const WARM_FROM = 338;
const WARM_ARC = 58;
const warmHue = (h) => (WARM_FROM + (((((h % 360) + 360) % 360) / 360) * WARM_ARC)) % 360;

export function fallbackPalette(seed) {
  const hue = warmHue(hashHue(String(seed)));
  return {
    glow: `hsl(${hue} 62% 68%)`,
    glow2: `hsl(${warmHue(hashHue(String(seed)) + 120)} 48% 62%)`,
  };
}

/* Every generated cover — a shelf tile, a record label, an artist with no poster — is drawn
   from this, so the app keeps one colour story instead of one per name. */
export function warmGradient(seed) {
  const h = hashHue(String(seed));
  return `linear-gradient(140deg, hsl(${warmHue(h)} 66% 68%), hsl(${warmHue(h + 120)} 52% 52%))`;
}

const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

export function paletteFor(url, seed) {
  if (!url) return Promise.resolve(fallbackPalette(seed));
  if (cache.has(url)) return Promise.resolve(cache.get(url));

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const done = (palette) => {
      cache.set(url, palette);
      resolve(palette);
    };
    img.onerror = () => done(fallbackPalette(seed));
    img.onload = () => {
      try {
        const size = 36;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let best = { s: -1, l: 0.5, h: 0 };
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let n = 0;
        const buckets = new Map();

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue;
          const r = data[i] / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;
          sumR += r;
          sumG += g;
          sumB += b;
          n += 1;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const l = (max + min) / 2;
          const d = max - min;
          const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
          let h = 0;
          if (d !== 0) {
            if (max === r) h = 60 * (((g - b) / d) % 6);
            else if (max === g) h = 60 * ((b - r) / d + 2);
            else h = 60 * ((r - g) / d + 4);
          }
          if (h < 0) h += 360;
          const bucket = Math.round(h / 24);
          const prev = buckets.get(bucket) ?? { count: 0, h: 0, s: 0, l: 0 };
          buckets.set(bucket, { count: prev.count + 1, h: prev.h + h, s: prev.s + s, l: prev.l + l });
          const score = s * (l > 0.18 && l < 0.86 ? 1 : 0.25);
          if (score > best.s) best = { s: score, l, h };
        }

        if (!n) return done(fallbackPalette(seed));
        const ranked = [...buckets.values()].sort((a, b) => b.count * b.s - a.count * a.s)[0];
        const dominantHue = ranked.count ? ranked.h / ranked.count : best.h;
        const avgL = (sumR + sumG + sumB) / (3 * n);

        const glow = hslToHex(warmHue(dominantHue), 0.66, Math.min(0.78, Math.max(0.56, avgL * 0.7 + 0.34)));
        const glow2 = hslToHex(warmHue(dominantHue + 46), 0.5, Math.min(0.74, Math.max(0.52, avgL * 0.7 + 0.3)));
        done({ glow, glow2 });
      } catch {
        done(fallbackPalette(seed));
      }
    };
    img.src = url;
  });
}
