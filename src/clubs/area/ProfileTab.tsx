import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { FIELD_CLASS, Input } from '../../components/Input';
import { useNotify } from '../../components/Notice';
import { useAuth } from '../../auth/AuthContext';
import { CLUB_COUNTRY_CODES, updateClubProfile } from '../clubAdminApi';
import { ITALIAN_ENABLED } from '../../i18n/locales';
import { useLocale, useT } from '../../i18n/I18nProvider';
import type { ClubLocale } from '../../types/club';

const LOCALES: { id: ClubLocale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'it', label: 'Italiano' },
];

const GROUP = 'overflow-hidden rounded-lg bg-surface shadow-card';
// A row of at least 52px with a hairline above it, inset like ListRow.
const ROW = 'relative min-h-[52px] px-4 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden';

function CheckRow({ id, title, description, checked, disabled, onChange }: {
  id: string; title: string; description: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className={`${ROW} flex items-center gap-3 py-2`}>
      <span className="flex min-w-0 flex-1 flex-col">
        {/* The label's overlay makes the whole row the tap target, while the name stays the title only. */}
        <label htmlFor={id} className="cursor-pointer text-headline text-ink after:absolute after:inset-0">{title}</label>
        <span id={`${id}-description`} className="text-footnote text-ink-2">{description}</span>
      </span>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} aria-describedby={`${id}-description`}
        onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-[rgb(var(--color-ink))]" />
    </div>
  );
}

export function ProfileTab({ restricted = false }: { restricted?: boolean }) {
  const { club } = useAuth();
  const notify = useNotify();
  const t = useT();
  const p = t.clubs.profile;
  const { locale: uiLocale } = useLocale();
  const regionNames = useMemo(() => new Intl.DisplayNames([uiLocale], { type: 'region' }), [uiLocale]);
  const countries = useMemo(
    () => [...CLUB_COUNTRY_CODES].sort((a, b) => (regionNames.of(a) ?? a).localeCompare(regionNames.of(b) ?? b, uiLocale)),
    [regionNames, uiLocale],
  );
  const [name, setName] = useState(club?.name ?? '');
  const [country, setCountry] = useState(club?.country ?? '');
  const [locale, setLocale] = useState<ClubLocale>(club?.locale ?? 'en');
  const [aiEnabled, setAiEnabled] = useState(club?.aiEnabled ?? false);
  const [growthTestsEnabled, setGrowthTestsEnabled] = useState(club?.growthTestsEnabled ?? false);
  const [referenceOptOut, setReferenceOptOut] = useState(club?.referenceOptOut ?? false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!club) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!club) return;
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setNameError(p.nameLength);
      return;
    }
    setNameError(null);
    setError(null);
    setSaving(true);
    try {
      await updateClubProfile({
        name: trimmed, country, locale, aiEnabled,
        referenceOptOut, growthTestsEnabled,
      });
      setName(trimmed);
      notify(p.saved);
    } catch {
      setError(t.common.couldNotSave);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex max-w-xl flex-col gap-6">
      <div className={GROUP}>
        <div className={`${ROW} flex flex-col gap-1 py-2`}>
          <label htmlFor="club-name" className="text-callout text-ink-2">{p.nameLabel}</label>
          <Input id="club-name" value={name} disabled={restricted} onChange={(e) => setName(e.target.value)}
            aria-invalid={!!nameError} aria-describedby={nameError ? 'club-name-error' : undefined} />
          {nameError && <p id="club-name-error" role="alert" className="text-footnote text-red-strong">{nameError}</p>}
        </div>
        <div className={`${ROW} flex flex-col gap-1 py-2`}>
          <label htmlFor="club-country" className="text-callout text-ink-2">{p.country}</label>
          <select id="club-country" value={country} disabled={restricted} onChange={(e) => setCountry(e.target.value)}
            className={`${FIELD_CLASS} w-full`}>
            {!CLUB_COUNTRY_CODES.includes(country) && <option value={country}>{country}</option>}
            {countries.map((c) => <option key={c} value={c}>{regionNames.of(c) ?? c}</option>)}
          </select>
        </div>
        <div className={`${ROW} flex flex-col gap-1 py-2`}>
          <label htmlFor="club-locale" className="text-callout text-ink-2">{t.settings.languageLabel}</label>
          <select id="club-locale" value={locale} disabled={restricted}
            onChange={(e) => setLocale(e.target.value as ClubLocale)} className={`${FIELD_CLASS} w-full`}>
            {LOCALES.filter((l) => ITALIAN_ENABLED || l.id === 'en' || l.id === club.locale).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
      </div>

      <div className={GROUP}>
        <CheckRow id="club-ai" title={p.aiTitle} description={p.aiDescription} checked={aiEnabled}
          disabled={restricted} onChange={setAiEnabled} />
        <CheckRow id="club-growth" title={p.growthTitle} description={p.growthDescription}
          checked={growthTestsEnabled} disabled={restricted} onChange={setGrowthTestsEnabled} />
      </div>

      <div className={GROUP}>
        <CheckRow id="club-reference" title={p.referenceTitle} description={p.referenceDescription}
          checked={referenceOptOut} disabled={restricted} onChange={setReferenceOptOut} />
      </div>

      {error && <p role="alert" className="text-red-strong">{error}</p>}
      {!restricted && (
        <Button type="submit" variant="primary" className="w-full sm:w-auto sm:self-start" disabled={saving}>
          {t.common.save}
        </Button>
      )}
    </form>
  );
}
