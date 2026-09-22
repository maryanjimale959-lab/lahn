import { coverFor } from '../lib/api.js';
import { warmGradient } from '../lib/art.js';
import { initials } from '../lib/format.js';
import { Icon } from './Icons.jsx';

/* Needle landing radii, measured from the deck: pivot (88%,14%), arm 42% long,
   disc centred at (42%,50%) with a 36% radius. Parked rests clear of the record. */
const PARKED = 88;
const OUTER = 107;
const INNER = 129;

export function Vinyl({ track, playing, loading, progress = 0 }) {
  const cover = coverFor(track?.cover);
  const art = warmGradient(track?.title ?? 'Laxan');
  const landed = playing || loading;
  const angle = landed ? OUTER + (INNER - OUTER) * Math.min(1, Math.max(0, progress)) : PARKED;

  return (
    <div className="deck">
      <div className="deck-body">
        <span className="deck-mark" aria-hidden="true">
          <Icon.disc />
        </span>
        <div className="disc-well" />
        <div className={`disc ${playing ? 'spinning' : ''}`}>
          <span className="disc-label">
            {cover ? (
              <img src={cover} alt="" decoding="async" />
            ) : (
              <span
                className="mono"
                style={{ background: art }}
              >
                {initials(track?.title ?? 'Laxan')}
              </span>
            )}
          </span>
        </div>
        <span className="spindle" />
        <div className="tonearm" style={{ '--arm-angle': `${angle}deg` }}>
          <span className="tonearm-pivot" />
          <div className="tonearm-arm">
            <i />
            <span className="weight" />
            <span className="head" />
          </div>
        </div>
        <div className="deck-controls">
          <span className={`deck-knob ${playing ? 'live' : ''}`} />
          <span className={`deck-led ${playing ? 'live' : ''}`} />
        </div>
      </div>
    </div>
  );
}
