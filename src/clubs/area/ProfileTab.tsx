import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { FIELD_CLASS, Input } from '../../components/Input';
import { useNotify } from '../../components/Notice';
import { useAuth } from '../../auth/AuthContext';
import { CLUB_COUNTRY_CODES, updateClubProfile } from '../clubAdminApi';
import { ITALIAN_ENABLED } from '../../i18n/locales';
import type { ClubLocale } from '../../types/club';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const LOCALES: { id: ClubLocale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'it', label: 'Italiano' },
];

export function ProfileTab({ restricted = false }: { restricted?: boolean }) {
  const { club } = useAuth();
  const notify = useNotify();
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
      setNameError('The club name must be between 2 and 80 characters.');
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
      notify('Club details saved');
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate
      className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-col gap-1">
        <label htmlFor="club-name" className="text-sm font-medium text-ink">Club name</label>
        <Input id="club-name" value={name} disabled={restricted} onChange={(e) => setName(e.target.value)}
          aria-invalid={!!nameError} aria-describedby={nameError ? 'club-name-error' : undefined} />
        {nameError && <p id="club-name-error" role="alert" className="text-sm text-red">{nameError}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="club-country" className="text-sm font-medium text-ink">Country</label>
        <select id="club-country" value={country} disabled={restricted} onChange={(e) => setCountry(e.target.value)}
          className={`${FIELD_CLASS} w-full`}>
          {!CLUB_COUNTRY_CODES.includes(country) && <option value={country}>{country}</option>}
          {CLUB_COUNTRY_CODES.map((c) => <option key={c} value={c}>{regionNames.of(c) ?? c}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="club-locale" className="text-sm font-medium text-ink">Language</label>
        <select id="club-locale" value={locale} disabled={restricted}
          onChange={(e) => setLocale(e.target.value as ClubLocale)} className={`${FIELD_CLASS} w-full`}>
          {LOCALES.filter((l) => ITALIAN_ENABLED || l.id === 'en' || l.id === club.locale).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>

      <div className="flex items-start gap-3">
        <input id="club-ai" type="checkbox" checked={aiEnabled} disabled={restricted}
          onChange={(e) => setAiEnabled(e.target.checked)} className="mt-1" />
        <div>
          <label htmlFor="club-ai" className="text-sm font-medium text-ink">AI features</label>
          <p className="text-sm text-slate">
            Lets your staff use AI drafting and text scouting with their own provider key. Off by default.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <input id="club-growth" type="checkbox" checked={growthTestsEnabled} disabled={restricted}
          onChange={(e) => setGrowthTestsEnabled(e.target.checked)} className="mt-1" />
        <div>
          <label htmlFor="club-growth" className="text-sm font-medium text-ink">Growth tests</label>
          <p className="text-sm text-slate">
            Height and body mass may be health data. Only switch on if your club has a lawful basis to record them.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <input id="club-reference" type="checkbox" checked={referenceOptOut} disabled={restricted}
          onChange={(e) => setReferenceOptOut(e.target.checked)} className="mt-1" />
        <div>
          <label htmlFor="club-reference" className="text-sm font-medium text-ink">Don't name our club as a customer</label>
          <p className="text-sm text-slate">We won't list your club as a reference customer.</p>
        </div>
      </div>

      {error && <p role="alert" className="text-red">{error}</p>}
      {!restricted && (
        <Button type="submit" variant="primary" className="w-full sm:w-auto sm:self-start" disabled={saving}>
          Save
        </Button>
      )}
    </form>
  );
}
