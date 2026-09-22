import { usePlayer } from '../state/player.jsx';

/**
 * The turntable mark. `spin` follows playback so the brand in the sidebar is a live
 * indicator, not decoration.
 */
export function LogoMark({ size = 34, spin = false, className = '' }) {
  const spinning = spin && Boolean(usePlayer()?.playing);
  return (
    <svg
      className={`logo-mark ${spinning ? 'spinning' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Laxan"
    >
      <defs>
        <radialGradient id="lm-disc" cx="40%" cy="32%" r="74%">
          <stop offset="0%" stopColor="#3a3740" />
          <stop offset="55%" stopColor="#141317" />
          <stop offset="100%" stopColor="#08080a" />
        </radialGradient>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fdf6ee" />
          <stop offset="100%" stopColor="#f0d9c7" />
        </linearGradient>
        <linearGradient id="lm-label" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff9d5c" />
          <stop offset="100%" stopColor="#e0523f" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="15" fill="url(#lm-bg)" />
      <g className="lm-platter">
        <circle cx="27" cy="37" r="20" fill="url(#lm-disc)" />
        <g fill="none" stroke="#ffffff" strokeOpacity="0.10">
          <circle cx="27" cy="37" r="17.5" strokeWidth="0.6" />
          <circle cx="27" cy="37" r="14.5" strokeWidth="0.6" />
          <circle cx="27" cy="37" r="11.5" strokeWidth="0.6" />
        </g>
        <circle cx="27" cy="37" r="8" fill="url(#lm-label)" />
        <circle cx="27" cy="37" r="1.5" fill="#f2f1ee" />
      </g>
      <g>
        <circle cx="49" cy="17" r="5" fill="#d9d3cc" />
        <circle cx="49" cy="17" r="2.4" fill="#8b857d" />
        <rect x="47.6" y="19" width="2.8" height="21" rx="1.4" fill="#e6e1db" transform="rotate(-22 49 17)" />
        <rect x="36" y="35" width="5.4" height="7" rx="2" fill="#f7f4ef" transform="rotate(-22 38 38)" />
      </g>
    </svg>
  );
}

export function Logo({ size = 34, stacked = false }) {
  return (
    <span className={`logo ${stacked ? 'stacked' : ''}`}>
      <LogoMark size={size} spin />
      <span className="logo-word">
        <b>Laxan</b>
      </span>
    </span>
  );
}
