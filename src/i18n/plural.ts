import type { Locale } from './locales';

/** English and Italian share the same two CLDR categories (one, other); Intl decides which applies. */
export function plural(locale: Locale, n: number, forms: { one: string; other: string }): string {
  return new Intl.PluralRules(locale).select(n) === 'one' ? forms.one : forms.other;
}
