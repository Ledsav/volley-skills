import { useT } from '../i18n/I18nProvider';
import { LEGAL_LANGS, type LegalLang } from './versions';

const LABELS: Record<LegalLang, string> = {
  en: 'English', it: 'Italiano', fr: 'Français', de: 'Deutsch', es: 'Español',
};

export function LegalLangSwitcher({ lang, onChange }: { lang: LegalLang; onChange: (lang: LegalLang) => void }) {
  const t = useT();
  return (
    <div role="group" aria-label={t.legal.langSwitcher} className="flex flex-wrap gap-2">
      {LEGAL_LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === lang}
          onClick={() => onChange(l)}
          className={`min-h-11 rounded-full px-3.5 text-callout focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            l === lang ? 'bg-ink font-semibold text-on-ink' : 'bg-surface-2 text-ink hover:bg-surface-3'
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
