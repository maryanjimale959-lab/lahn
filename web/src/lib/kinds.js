export const KINDS = ['song', 'podcast', 'book', 'story', 'lesson'];

export const TALKS = ['podcast', 'book', 'story', 'lesson'];

export const KIND_KEY = {
  song: 'kind.song',
  podcast: 'kind.podcast',
  book: 'kind.book',
  story: 'kind.story',
  lesson: 'kind.lesson',
};

/* Noun keys for count(...); matches the plural tables in i18n.js. */
export const KIND_NOUN = { song: 'song', podcast: 'podcast', book: 'book', story: 'story', lesson: 'lesson' };

export const KIND_ICON = { song: 'song', podcast: 'mic', book: 'lesson', story: 'story', lesson: 'lesson' };

export const isSong = (kind) => !kind || kind === 'song';

/** Which shelf holds each spoken kind, so a filter and a home row agree. */
export const KIND_SHELF = { podcast: 'podcasts', book: 'books', story: 'stories', lesson: 'lessons' };
