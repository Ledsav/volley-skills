import { useState } from 'react';
import { Check } from 'lucide-react';
import { GroupedList, ListRow } from '../components/GroupedList';
import { Sheet } from '../components/Sheet';
import { useLocale, useT } from '../i18n/I18nProvider';
import { ITALIAN_ENABLED, type Locale } from '../i18n/locales';

/** Personal language choice; hidden while Italian is not switched on. */
export function LanguageSettings() {
  const t = useT().settings;
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  if (!ITALIAN_ENABLED) return null;
  const options: { id: Locale; label: string }[] = [
    { id: 'en', label: t.english },
    { id: 'it', label: t.italian },
  ];
  const current = options.find((o) => o.id === locale)?.label ?? t.english;
  return (
    <>
      <GroupedList header={t.languageTitle} footer={t.languageDescription}>
        <ListRow onClick={() => setOpen(true)} title={t.languageLabel} trailing={current} />
      </GroupedList>
      {open && (
        <Sheet title={t.languageLabel} detent="content" onClose={() => setOpen(false)}>
          <GroupedList>
            {options.map((o) => (
              <ListRow
                key={o.id}
                title={o.label}
                trailing={o.id === locale ? <Check size={18} aria-hidden="true" /> : undefined}
                rowProps={{ 'aria-current': o.id === locale ? 'true' : undefined }}
                onClick={() => {
                  setLocale(o.id);
                  setOpen(false);
                }}
              />
            ))}
          </GroupedList>
        </Sheet>
      )}
    </>
  );
}
