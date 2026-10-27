/** Shape of every language's catalog; it grows one feature key at a time. */
export type Catalog = typeof import('./en').en;
