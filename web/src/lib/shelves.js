/** Home rows and the #/shelf/:id page agree through this table. */
export const SHELF_QUERY = {
  fresh: {},
  music: { shelf: 'music' },
  rap: { shelf: 'rap' },
  love: { shelf: 'love' },
  podcasts: { kind: 'podcast' },
  books: { kind: 'book' },
  stories: { kind: 'story' },
  lessons: { kind: 'lesson' },
};

export const shelfTitle = (id) => `shelf.${id}`;
