import { getLocale } from './I18nProvider';
import type { Locale } from './locales';

export type DateStyle = 'numeric' | 'short' | 'long' | 'weekday' | 'full';

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  numeric: {},
  short: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  weekday: { weekday: 'short', day: 'numeric', month: 'short' },
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
};

/** Formats a calendar date (local noon, so the day never shifts with the time zone). */
export function formatDateValue(d: Date, style: DateStyle, locale: Locale = getLocale()): string {
  return d.toLocaleDateString(locale, DATE_OPTIONS[style]);
}

/** "2026-10-26" -> "26 October 2026" (long, en) / "26 ottobre 2026" (long, it). */
export function formatDate(iso: string, style: DateStyle, locale: Locale = getLocale()): string {
  return formatDateValue(new Date(`${iso}T12:00:00`), style, locale);
}

function utcNames(
  count: number,
  make: (i: number) => Date,
  opts: Intl.DateTimeFormatOptions,
  locale: Locale,
): string[] {
  const f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' });
  return Array.from({ length: count }, (_, i) => f.format(make(i)));
}

/** Month names, January first. */
export function monthNames(locale: Locale = getLocale(), width: 'long' | 'short' = 'long'): string[] {
  return utcNames(12, (i) => new Date(Date.UTC(2021, i, 1)), { month: width }, locale);
}

/** Weekday names, Monday first. 2021-01-04 is a Monday. */
export function weekdayNames(width: 'short' | 'narrow' | 'long', locale: Locale = getLocale()): string[] {
  return utcNames(7, (i) => new Date(Date.UTC(2021, 0, 4 + i)), { weekday: width }, locale);
}

/** "October 2026"; `month` is 0-based. */
export function formatMonth(year: number, month: number, locale: Locale = getLocale()): string {
  return `${monthNames(locale)[month]} ${year}`;
}

/** Fixed-digit number with the locale's decimal separator and no grouping. */
export function formatNumber(n: number, digits: number, locale: Locale = getLocale()): string {
  const s = n.toFixed(digits);
  return locale === 'it' ? s.replace('.', ',') : s;
}

/** A number as typed (no fixed digits) with the locale's decimal separator: 2.35 -> "2,35" in Italian. */
export function formatDecimal(n: number, locale: Locale = getLocale()): string {
  const s = String(n);
  return locale === 'it' ? s.replace('.', ',') : s;
}

/** A 0..1 ratio as a whole percent, or an em dash when there is none. */
export function formatPercent(x: number | null, locale: Locale = getLocale()): string {
  if (x === null) return '—';
  return `${formatNumber(Math.round(x * 100), 0, locale)}%`;
}
