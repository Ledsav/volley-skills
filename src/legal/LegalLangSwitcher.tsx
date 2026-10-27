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
          className={`rounded-md border px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
            l === lang ? 'border-blue bg-blue/10 font-medium text-ink' : 'border-border text-slate hover:bg-bg'
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
