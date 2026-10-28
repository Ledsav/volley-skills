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
    <form onSubmit={(e) => void submit(e)} noValidate
      className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-col gap-1">
        <label htmlFor="club-name" className="text-sm font-medium text-ink">{p.nameLabel}</label>
        <Input id="club-name" value={name} disabled={restricted} onChange={(e) => setName(e.target.value)}
          aria-invalid={!!nameError} aria-describedby={nameError ? 'club-name-error' : undefined} />
        {nameError && <p id="club-name-error" role="alert" className="text-sm text-red-strong">{nameError}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="club-country" className="text-sm font-medium text-ink">{p.country}</label>
        <select id="club-country" value={country} disabled={restricted} onChange={(e) => setCountry(e.target.value)}
          className={`${FIELD_CLASS} w-full`}>
          {!CLUB_COUNTRY_CODES.includes(country) && <option value={country}>{country}</option>}
          {countries.map((c) => <option key={c} value={c}>{regionNames.of(c) ?? c}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="club-locale" className="text-sm font-medium text-ink">{t.settings.languageLabel}</label>
        <select id="club-locale" value={locale} disabled={restricted}
          onChange={(e) => setLocale(e.target.value as ClubLocale)} className={`${FIELD_CLASS} w-full`}>
          {LOCALES.filter((l) => ITALIAN_ENABLED || l.id === 'en' || l.id === club.locale).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>

      <div className="flex items-start gap-3">
        <input id="club-ai" type="checkbox" checked={aiEnabled} disabled={restricted}
          onChange={(e) => setAiEnabled(e.target.checked)} className="mt-1" />
        <div>
          <label htmlFor="club-ai" className="text-sm font-medium text-ink">{p.aiTitle}</label>
          <p className="text-sm text-slate">
            {p.aiDescription}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <input id="club-growth" type="checkbox" checked={growthTestsEnabled} disabled={restricted}
          onChange={(e) => setGrowthTestsEnabled(e.target.checked)} className="mt-1" />
        <div>
          <label htmlFor="club-growth" className="text-sm font-medium text-ink">{p.growthTitle}</label>
          <p className="text-sm text-slate">
            {p.growthDescription}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <input id="club-reference" type="checkbox" checked={referenceOptOut} disabled={restricted}
          onChange={(e) => setReferenceOptOut(e.target.checked)} className="mt-1" />
        <div>
          <label htmlFor="club-reference" className="text-sm font-medium text-ink">{p.referenceTitle}</label>
          <p className="text-sm text-slate">{p.referenceDescription}</p>
        </div>
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
