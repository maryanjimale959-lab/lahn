export const KINDS = ['song', 'podcast', 'book', 'story', 'lesson', 'quran'];

/* Recitation is not a podcast and not a book, so it stands on its own tab. */
export const TALKS = ['podcast', 'quran', 'book', 'story', 'lesson'];

export const KIND_KEY = {
  song: 'kind.song',
  podcast: 'kind.podcast',
  book: 'kind.book',
  quran: 'kind.quran',
  lesson: 'kind.lesson',
  story: 'kind.story',
};

/* Noun keys for count(...); matches the plural tables in i18n.js. */
export const KIND_NOUN = { song: 'song', podcast: 'podcast', book: 'book', story: 'story', lesson: 'lesson', quran: 'quran' };

export const KIND_ICON = { song: 'song', podcast: 'mic', book: 'library', story: 'story', lesson: 'lesson', quran: 'spark' };

export const isSong = (kind) => !kind || kind === 'song';

/** Which shelf holds each spoken kind, so a filter and a home row agree. */
export const KIND_SHELF = { podcast: 'podcasts', book: 'books', story: 'stories', lesson: 'lessons', quran: 'quran' };

/* The glyph each interest tile wears during sign-up. Keys are Icon component names. */
export const INTEREST_ART = {
  music: 'disc',
  rap: 'mic',
  love: 'heart',
  podcasts: 'channel',
  stories: 'story',
  lessons: 'lesson',
  books: 'library',
  amusic: 'song',
  apodcast: 'globe',
  quran: 'spark',
};
