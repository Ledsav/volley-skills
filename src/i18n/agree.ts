import type { Gender } from './catalog';

/** Picks the masculine, feminine or paired form of a word for a team's gender (Italian). */
export const agree = (g: Gender, men: string, women: string, mixed: string = men): string =>
  g === 'women' ? women : g === 'men' ? men : mixed;

/** An English entry that ignores gender but keeps the `(g) => string` shape of the catalog. */
export const sameForAll =
  (text: string): ((g: Gender) => string) =>
  () =>
    text;
