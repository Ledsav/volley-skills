import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { Catalog } from './catalog';
import { en } from './en';
import { ITALIAN_ENABLED, LOCALE_KEY, resolveLocale, type Locale } from './locales';

interface I18nValue {
  locale: Locale;
  catalog: Catalog;
  setLocale(l: Locale): void;
}

// Active state for non-component code (getT / getLocale), updated by the provider.
let activeLocale: Locale = 'en';
let activeCatalog: Catalog = en;

const I18nContext = createContext<I18nValue>({ locale: 'en', catalog: en, setLocale: () => {} });

function readStored(): string | null {
  try {
    return localStorage.getItem(LOCALE_KEY);
  } catch {
    return null;
  }
}

function devParam(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('lang');
  } catch {
    return null;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { club } = useAuth();
  const clubLocale = club?.locale ?? null;
  const [stored, setStored] = useState<string | null>(readStored);

  const locale = resolveLocale({
    stored,
    clubLocale,
    browser: typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]),
    devParam: devParam(),
    dev: import.meta.env.DEV,
    enabled: ITALIAN_ENABLED,
  });

  // The Italian catalog is a separate chunk; English stays on screen until it has arrived.
  const [loaded, setLoaded] = useState<{ locale: Locale; catalog: Catalog }>({ locale: 'en', catalog: en });
  useEffect(() => {
    if (locale === 'en') return;
    let cancelled = false;
    void import('./it').then((m) => {
      if (!cancelled) setLoaded({ locale: 'it', catalog: m.it });
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const catalog = locale === 'en' ? en : loaded.locale === locale ? loaded.catalog : en;
  // Until the catalog arrives text is English, so the language in effect is English too.
  const effective: Locale = catalog === en ? 'en' : locale;
  activeLocale = effective;
  activeCatalog = catalog;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* storage unavailable: the choice lasts for this session only */
    }
    setStored(l);
  }, []);

  const value = useMemo(() => ({ locale, catalog, setLocale }), [locale, catalog, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Catalog {
  return useContext(I18nContext).catalog;
}

export function useLocale(): { locale: Locale; setLocale(l: Locale): void } {
  const { locale, setLocale } = useContext(I18nContext);
  return { locale, setLocale };
}

/** The active catalog for non-component code. */
export function getT(): Catalog {
  return activeCatalog;
}

/** The active locale for non-component code, in step with getT(). */
export function getLocale(): Locale {
  return activeLocale;
}
