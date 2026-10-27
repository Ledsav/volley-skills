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
    <div role="group" aria-label={t.settings.interfaceLanguage} className={`flex gap-1 ${className}`}>
      {CODES.map((c) => (
        <button
          key={c.id}
          type="button"
          lang={c.id}
          aria-pressed={locale === c.id}
          onClick={() => setLocale(c.id)}
          className={`rounded-md border px-2 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            locale === c.id ? 'border-white bg-white/20 text-white' : 'border-white/40 text-white/80 hover:bg-white/10'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
