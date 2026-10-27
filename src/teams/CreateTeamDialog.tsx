import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { FIELD_CLASS, Input, Textarea } from '../components/Input';
import { useSave } from '../components/useSave';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';
import { GENDERS, isGender } from './teamGender';
import { createTeam } from './teamsApi';

interface CreateTeamDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

const labelClass = 'mb-1 block text-sm font-medium text-ink';
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
      setError('Could not create the team. Please try again.');
      return;
    }
    onCreated();
  }

  return (
    <Dialog title="Create team" onClose={onClose} guardUnsaved>
      <form onSubmit={handleSubmit} aria-label="Create team">

        <div className={fieldClass}>
          <label htmlFor="team-name" className={labelClass}>
            Name
          </label>
          <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className={fieldClass}>
          <label htmlFor="team-age-group" className={labelClass}>
            Age group
          </label>
          <Input id="team-age-group" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} required />
        </div>

        <div className={fieldClass}>
          <label htmlFor="team-season" className={labelClass}>
            Season
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
            Description
          </label>
          <Textarea
            id="team-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-h-[80px] resize-y"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving || gender === ''}>
            {saving ? 'Saving…' : 'Create'}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-right text-sm text-red">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
