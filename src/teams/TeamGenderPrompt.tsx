import { useState } from 'react';
import { Button } from '../components/Button';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';
import { GENDERS } from './teamGender';
import { updateTeamInfo } from './teamsApi';

interface TeamGenderPromptProps {
  teamId: string;
  onSaved: (gender: Gender) => void;
}

/** One-time question for team admins on a team created before gender existed. */
export function TeamGenderPrompt({ teamId, onSaved }: TeamGenderPromptProps) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function choose(gender: Gender) {
    setError(false);
    setSaving(true);
    try {
      await updateTeamInfo(teamId, { gender });
    } catch {
      setError(true);
      setSaving(false);
      return;
    }
    onSaved(gender);
  }

  return (
    <section className="mb-4 rounded-lg bg-surface p-4 shadow-card" aria-label={t.teams.gender.label}>
      <h2 className="text-headline text-ink">{t.teams.gender.prompt}</h2>
      <p className="mt-1 text-callout text-ink-2">{t.teams.gender.promptHint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {GENDERS.map((g) => (
          <Button key={g} variant="secondary" size="sm" disabled={saving} onClick={() => void choose(g)}>
            {t.teams.gender[g]}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-callout text-red-strong">
          {t.teams.gender.saveError}
        </p>
      )}
    </section>
  );
}
