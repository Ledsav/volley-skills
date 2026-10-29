import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Sheet } from '../components/Sheet';
import { FIELD_CLASS, FIELD_LABEL_CLASS, Input, Textarea } from '../components/Input';
import { useSave } from '../components/useSave';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';
import { GENDERS, isGender } from './teamGender';
import { createTeam } from './teamsApi';

interface CreateTeamDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

const labelClass = FIELD_LABEL_CLASS;
const fieldClass = 'mb-4';

export function CreateTeamDialog({ onClose, onCreated }: CreateTeamDialogProps) {
  const { firebaseUser, appUser } = useAuth();
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [season, setSeason] = useState('');
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const t = useT();
  const [error, setError] = useState<string | null>(null);

  const { saving, save } = useSave();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!firebaseUser || !appUser || !isGender(gender)) return;
    const { uid } = firebaseUser;
    const email = appUser.email;
    try {
      const done = await save(() => createTeam({ name, ageGroup, season, description, gender }, uid, email));
      if (!done) return;
    } catch {
      setError(t.teams.create.error);
      return;
    }
    onCreated();
  }

  return (
    <Sheet
      title={t.teams.create.title}
      onClose={onClose}
      guardUnsaved
      confirm={{ label: saving ? t.teams.shared.saving : t.teams.create.submit, form: 'create-team-form', disabled: saving || gender === '' }}
    >
      <form id="create-team-form" onSubmit={handleSubmit} aria-label={t.teams.create.title}>

        <div className={fieldClass}>
          <label htmlFor="team-name" className={labelClass}>
            {t.teams.create.name}
          </label>
          <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className={fieldClass}>
          <label htmlFor="team-age-group" className={labelClass}>
            {t.teams.create.ageGroup}
          </label>
          <Input id="team-age-group" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} required />
        </div>

        <div className={fieldClass}>
          <label htmlFor="team-season" className={labelClass}>
            {t.teams.create.season}
          </label>
          <Input id="team-season" value={season} onChange={(e) => setSeason(e.target.value)} required />
        </div>

        <div className={fieldClass}>
          <label htmlFor="team-gender" className={labelClass}>
            {t.teams.gender.label}
          </label>
          <select
            id="team-gender"
            className={`${FIELD_CLASS} w-full`}
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | '')}
            required
          >
            <option value="" disabled>
              {t.teams.gender.choose}
            </option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {t.teams.gender[g]}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClass}>
          <label htmlFor="team-description" className={labelClass}>
            {t.teams.create.description}
          </label>
          <Textarea
            id="team-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-h-[80px] resize-y"
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-callout text-red-strong">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}
