/**
 * Home rows and the #/shelf/:id page agree through this table: a shelf id is the filter the
 * server reads it back by, except the two rows that mix shelves together.
 */
export const shelfQuery = (id) => (id === 'fresh' || id === 'foryou' ? {} : { shelf: id });

export const shelfTitle = (id) => `shelf.${id}`;
