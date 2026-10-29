import { useLocale, useT } from './I18nProvider';
import { ITALIAN_ENABLED, type Locale } from './locales';

const CODES: { id: Locale; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'it', label: 'IT' },
];

/** EN/IT switch for public pages. It drives the app chrome only, never the legal text's own language. */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const t = useT();
  const { locale, setLocale } = useLocale();
  if (!ITALIAN_ENABLED) return null;
  return (
    <div role="group" aria-label={t.settings.interfaceLanguage} className={`inline-flex rounded-full bg-surface-2 p-0.5 ${className}`}>
      {CODES.map((c) => (
        <button
          key={c.id}
          type="button"
          lang={c.id}
          aria-pressed={locale === c.id}
          onClick={() => setLocale(c.id)}
          className={`min-h-9 min-w-11 rounded-full px-2 text-caption ${
            locale === c.id ? 'bg-surface text-ink shadow-card' : 'text-ink-2'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
