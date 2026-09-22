const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const F = { fill: 'currentColor' };

const wrap = (children, opts = S, extra = null) => (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...opts} {...(extra ?? {})} {...props}>
    {children}
  </svg>
);

export const Icon = {
  library: wrap(<><path d="M4 5v14" {...S} /><path d="M9 5v14" {...S} /><path d="M14.5 6.5l4.2 13" {...S} /></>),
  song: wrap(<><path d="M9 18V6l10-2v12" {...S} /><circle cx="6.5" cy="18" r="2.6" {...S} /><circle cx="16.5" cy="16" r="2.6" {...S} /></>),
  artist: wrap(<><circle cx="12" cy="8" r="3.6" {...S} /><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" {...S} /></>),
  disc: wrap(<><circle cx="12" cy="12" r="8.6" {...S} /><circle cx="12" cy="12" r="2.4" {...S} /><path d="M12 3.4a8.6 8.6 0 0 1 8.6 8.6" {...S} /></>),
  playlist: wrap(<><path d="M4 6h11M4 11h11M4 16h7" {...S} /><path d="M18 12.5v6.2" {...S} /><circle cx="20.4" cy="19" r="1.7" {...S} /></>),
  search: wrap(<><circle cx="11" cy="11" r="6.4" {...S} /><path d="M16 16l4 4" {...S} /></>),
  settings: wrap(
    <>
      <circle cx="12" cy="12" r="3.1" {...S} />
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        {...S}
      />
    </>,
  ),
  plus: wrap(<path d="M12 5v14M5 12h14" {...S} />),
  play: wrap(<path d="M8 5.4l11 6.6-11 6.6z" {...F} />),
  pause: wrap(<><rect x="7" y="5" width="3.6" height="14" rx="1.4" {...F} /><rect x="13.4" y="5" width="3.6" height="14" rx="1.4" {...F} /></>),
  next: wrap(<><path d="M6 6l9 6-9 6z" {...F} /><rect x="16.6" y="6" width="2.4" height="12" rx="1.2" {...F} /></>),
  prev: wrap(<><path d="M18 6l-9 6 9 6z" {...F} /><rect x="5" y="6" width="2.4" height="12" rx="1.2" {...F} /></>),
  shuffle: wrap(<><path d="M3 7h3.6c1.4 0 2.2.7 3 1.9l4.2 6.2c.8 1.2 1.6 1.9 3 1.9H21" {...S} /><path d="M3 17h3.6c1.4 0 2.2-.7 3-1.9l.9-1.3" {...S} /><path d="M14.2 8.5l.9-1.3c.8-1.2 1.6-1.9 3-1.9H21" {...S} /><path d="M18.4 3.2L21 5.3l-2.6 2.1M18.4 13.2L21 15.3l-2.6 2.1" {...S} /></>),
  repeat: wrap(<><path d="M6.5 7.5h9.8c1.7 0 3 1.3 3 3v1" {...S} /><path d="M17.5 5.5l2 2-2 2" {...S} /><path d="M17.5 16.5H7.7c-1.7 0-3-1.3-3-3v-1" {...S} /><path d="M6.5 18.5l-2-2 2-2" {...S} /></>),
  repeatOne: wrap(<><path d="M6.5 7.5h9.8c1.7 0 3 1.3 3 3v1" {...S} /><path d="M17.5 5.5l2 2-2 2" {...S} /><path d="M17.5 16.5H7.7c-1.7 0-3-1.3-3-3v-1" {...S} /><path d="M6.5 18.5l-2-2 2-2" {...S} /><path d="M11.4 10.4l1.3-.8v4.4" {...S} /></>),
  heart: wrap(<path d="M12 20s-7.4-4.4-7.4-9.3A4.2 4.2 0 0 1 12 8.3a4.2 4.2 0 0 1 7.4 2.4C19.4 15.6 12 20 12 20z" {...S} />),
  heartOn: wrap(<path d="M12 20s-7.4-4.4-7.4-9.3A4.2 4.2 0 0 1 12 8.3a4.2 4.2 0 0 1 7.4 2.4C19.4 15.6 12 20 12 20z" {...F} />),
  close: wrap(<path d="M6 6l12 12M18 6L6 18" {...S} />),
  down: wrap(<path d="M6 9.5l6 6 6-6" {...S} />),
  back: wrap(<path d="M15 5l-7 7 7 7" {...S} />),
  queue: wrap(<><path d="M4 6h9M4 11h9M4 16h6" {...S} /><path d="M17.5 10v8" {...S} /><circle cx="19.6" cy="18.4" r="1.6" {...S} /></>),
  link: wrap(<><path d="M10.5 13.5a3.6 3.6 0 0 0 5.1 0l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2" {...S} /><path d="M13.5 10.5a3.6 3.6 0 0 0-5.1 0l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2" {...S} /></>),
  check: wrap(<path d="M5 12.8l4.4 4.2L19 7" {...S} />),
  trash: wrap(<><path d="M4.8 7h14.4M9 7V5.2h6V7M6.6 7l.9 12.2h9l.9-12.2" {...S} /></>),
  sun: wrap(<><circle cx="12" cy="12" r="4.2" {...S} /><path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.1 6.1L4.6 4.6M19.4 19.4l-1.5-1.5M6.1 17.9l-1.5 1.5M19.4 4.6l-1.5 1.5" {...S} /></>),
  moon: wrap(<path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.6 8.6 0 1 0 20 14.2z" {...S} />),
  globe: wrap(<><circle cx="12" cy="12" r="8.6" {...S} /><path d="M3.6 12h16.8M12 3.4c2.4 2.4 3.4 5.4 3.4 8.6s-1 6.2-3.4 8.6c-2.4-2.4-3.4-5.4-3.4-8.6s1-6.2 3.4-8.6z" {...S} /></>),
  folder: wrap(<path d="M3.6 7.4c0-1 .8-1.8 1.8-1.8h3.2l1.8 2.4h6.2c1 0 1.8.8 1.8 1.8v7.6c0 1-.8 1.8-1.8 1.8H5.4c-1 0-1.8-.8-1.8-1.8z" {...S} />),
  more: wrap(<><circle cx="12" cy="5.5" r="1.6" {...F} /><circle cx="12" cy="12" r="1.6" {...F} /><circle cx="12" cy="18.5" r="1.6" {...F} /></>),
  spark: wrap(<><path d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6L5.7 9.8l4.6-1.7z" {...S} /><path d="M18.6 15.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" {...S} /></>),
  download: wrap(<><path d="M12 4v10.4M8 11l4 4 4-4" {...S} /><path d="M4.6 18.4h14.8" {...S} /></>),
  laptop: wrap(<><rect x="4" y="5" width="16" height="11" rx="1.8" {...S} /><path d="M2.6 19h18.8" {...S} /></>),
  phone: wrap(<><rect x="7.5" y="3" width="9" height="18" rx="2.4" {...S} /><path d="M11 18h2" {...S} /></>),
  wifi: wrap(<><path d="M4 9a12 12 0 0 1 16 0M7 12.4a8 8 0 0 1 10 0M10 15.8a4 4 0 0 1 4 0" {...S} /><circle cx="12" cy="19" r="1.2" {...F} /></>),
  mic: wrap(<><rect x="9.2" y="3" width="5.6" height="11" rx="2.8" {...S} /><path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.8V21M9 21h6" {...S} /></>),
  lesson: wrap(<><path d="M12 6.6C10.4 5.3 8.4 4.8 4.8 4.8v12.6c3.6 0 5.6.5 7.2 1.8 1.6-1.3 3.6-1.8 7.2-1.8V4.8c-3.6 0-5.6.5-7.2 1.8z" {...S} /><path d="M12 6.6v12.6" {...S} /></>),
  channel: wrap(<><rect x="2.6" y="5.4" width="18.8" height="13.2" rx="3.4" {...S} /><path d="M10.2 9.4l5 2.6-5 2.6z" {...F} /></>),
  story: wrap(<><path d="M4.8 5.4h14.4c1 0 1.8.8 1.8 1.8v7.6c0 1-.8 1.8-1.8 1.8H9.4L4.8 20.4z" {...S} /><path d="M8.4 9.6h7.2M8.4 12.8h4.6" {...S} /></>),
};
