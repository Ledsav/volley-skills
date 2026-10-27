/** Shape of every language's catalog; it grows one feature key at a time. */
export type Catalog = typeof import('./en').en;

/** Grammatical gender of a team, used where Italian labels agree with the players they name. */
export type Gender = 'women' | 'men' | 'mixed';
