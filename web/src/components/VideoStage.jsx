import { useEffect, useRef, useState } from 'react';
import { mount } from '../lib/embed.js';
import { usePlayer } from '../state/player.jsx';
import { Icon } from './Icons.jsx';
import { useUi } from '../state/ui.jsx';

/* The one surface every embedded video is drawn into, and it never moves: YouTube's player
   restarts when its element is pulled out of the page and put back, so the stage stays where it
   was born and only its shape changes — a card in the corner while you browse, the top of the
   player screen once you open it. */
export function VideoStage({ open }) {
  const { t } = useUi();
  const { embed, current } = usePlayer();
  const host = useRef(null);
  const built = useRef(false);
  const [folded, setFolded] = useState(false);

  useEffect(() => {
    if (built.current || !embed || !host.current) return;
    built.current = true;
    mount(host.current);
  }, [embed]);

  if (!current) return null;
  const shown = Boolean(embed) && !(folded && !open);
  return (
    <div className={`yt-stage ${shown ? (open ? 'on big' : 'on') : 'off'}`}>
      <div className="yt-host" ref={host} />
      {embed && !open ? (
        <button type="button" className="yt-fold" onClick={() => setFolded((v) => !v)} title={t('player.video')} aria-label={t('player.video')}>
          {folded ? <Icon.play /> : <Icon.close />}
        </button>
      ) : null}
    </div>
  );
}
