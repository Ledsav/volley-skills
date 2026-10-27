export type Locale = 'en' | 'it';

/** Master switch: while false the resolver never returns `it` (except the dev `?lang=it` override). */
export const ITALIAN_ENABLED = false;

export const LOCALE_KEY = 'vcb.locale';

export interface ResolveInput {
  stored: string | null;
  clubLocale: Locale | null;
  browser: readonly string[];
  devParam: string | null;
  dev: boolean;
  /** Defaults to ITALIAN_ENABLED; callers that must honour a mocked flag pass it explicitly. */
  enabled?: boolean;
}

function isLocale(v: string | null): v is Locale {
  return v === 'en' || v === 'it';
}

/** Order: stored, club locale, browser `it*`, then `en`. */
export function resolveLocale(input: ResolveInput): Locale {
  const enabled = input.enabled ?? ITALIAN_ENABLED;
  if (input.dev && input.devParam === 'it') return 'it';
  let result: Locale;
  if (isLocale(input.stored)) result = input.stored;
  else if (input.clubLocale) result = input.clubLocale;
  else if (input.browser.some((l) => l.toLowerCase().startsWith('it'))) result = 'it';
  else result = 'en';
  return result === 'it' && !enabled ? 'en' : result;
}
