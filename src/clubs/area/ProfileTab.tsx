import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Field, Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { SwitchRow } from '../../components/Switch';
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
// A row of at least 52px with a hairline above it, inset to the text like ListRow.
const ROW = 'relative min-h-[52px] px-4 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden';

function ToggleRow({ title, description, checked, disabled, onChange }: {
  title: string; description: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void;
}) {
  return <SwitchRow className={`${ROW} py-2`} label={title} description={description} checked={checked} disabled={disabled} onChange={onChange} />;
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
      <div className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-card">
        <div className="flex flex-col">
          <Field label={p.nameLabel}>
            <Input id="club-name" value={name} disabled={restricted} onChange={(e) => setName(e.target.value)}
              aria-invalid={!!nameError} aria-describedby={nameError ? 'club-name-error' : undefined} />
          </Field>
          {nameError && <p id="club-name-error" role="alert" className="mt-1.5 text-footnote text-red-strong">{nameError}</p>}
        </div>
        <Field label={p.country}>
          <Select id="club-country" value={country} disabled={restricted} onChange={(e) => setCountry(e.target.value)}>
            {!CLUB_COUNTRY_CODES.includes(country) && <option value={country}>{country}</option>}
            {countries.map((c) => <option key={c} value={c}>{regionNames.of(c) ?? c}</option>)}
          </Select>
        </Field>
        <Field label={t.settings.languageLabel}>
          <Select id="club-locale" value={locale} disabled={restricted}
            onChange={(e) => setLocale(e.target.value as ClubLocale)}>
            {LOCALES.filter((l) => ITALIAN_ENABLED || l.id === 'en' || l.id === club.locale).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </Select>
        </Field>
      </div>

      <div className={GROUP}>
        <ToggleRow title={p.aiTitle} description={p.aiDescription} checked={aiEnabled}
          disabled={restricted} onChange={setAiEnabled} />
        <ToggleRow title={p.growthTitle} description={p.growthDescription}
          checked={growthTestsEnabled} disabled={restricted} onChange={setGrowthTestsEnabled} />
      </div>

      <div className={GROUP}>
        <ToggleRow title={p.referenceTitle} description={p.referenceDescription}
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
