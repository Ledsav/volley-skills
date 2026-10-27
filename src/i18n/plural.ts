import type { Locale } from './locales';

/** English and Italian share the same two forms: 1 is singular, everything else plural. */
export function plural(_locale: Locale, n: number, forms: { one: string; other: string }): string {
  return n === 1 ? forms.one : forms.other;
}
