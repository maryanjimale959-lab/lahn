import { useEffect, useState } from 'react';
import { coverFor } from '../lib/api.js';
import { fallbackPalette, hashHue, paletteFor } from '../lib/art.js';
import { initials } from '../lib/format.js';

export function Art({ track, cover, name, className = '', children }) {
  const src = coverFor(track?.cover ?? cover);
  const label = track?.title ?? name ?? '';
  const [failed, setFailed] = useState(false);
  const hue = hashHue(label);

  useEffect(() => setFailed(false), [src]);

  return (
    <span
      className={`art ${className}`}
      style={{
        background: `linear-gradient(140deg, hsl(${hue} 66% 68%), hsl(${(hue + 46) % 360} 52% 52%))`,
      }}
    >
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className="mono">{initials(label)}</span>
      )}
      {children}
    </span>
  );
}

export function useAmbientGlow(stored, seed) {
  useEffect(() => {
    let alive = true;
    const root = document.documentElement;
    const apply = (palette) => {
      if (!alive) return;
      root.style.setProperty('--glow', palette.glow);
      root.style.setProperty('--glow-2', palette.glow2);
    };
    if (!stored) {
      apply(fallbackPalette(seed));
      return () => {
        alive = false;
      };
    }
    paletteFor(coverFor(stored), seed).then(apply);
    return () => {
      alive = false;
    };
  }, [stored, seed]);
}
