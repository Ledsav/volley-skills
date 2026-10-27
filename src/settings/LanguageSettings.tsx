import { FIELD_CLASS } from '../components/Input';
import { useLocale, useT } from '../i18n/I18nProvider';
import { ITALIAN_ENABLED, type Locale } from '../i18n/locales';
import { SettingsSection } from './SettingsSection';

/** Personal language choice; hidden while Italian is not switched on. */
export function LanguageSettings() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  if (!ITALIAN_ENABLED) return null;
  return (
    <SettingsSection title={t.settings.languageTitle} description={t.settings.languageDescription}>
      <label htmlFor="app-language" className="sr-only">{t.settings.languageLabel}</label>
      <select id="app-language" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}
        className={`${FIELD_CLASS} w-full sm:w-auto lg:self-start`}>
        <option value="en">{t.settings.english}</option>
        <option value="it">{t.settings.italian}</option>
      </select>
    </SettingsSection>
  );
}
