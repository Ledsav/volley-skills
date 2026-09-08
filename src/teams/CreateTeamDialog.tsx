import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { createTeam } from './teamsApi';

interface CreateTeamDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

const labelClass = 'mb-1 block text-sm font-medium text-ink';
const fieldClass = 'mb-4';

export function CreateTeamDialog({ onClose, onCreated }: CreateTeamDialogProps) {
  const { firebaseUser } = useAuth();
  const [name, setName] = useState('');
  const [club, setClub] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [season, setSeason] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!firebaseUser?.email) return;
    try {
      await createTeam({ name, club, ageGroup, season, description }, firebaseUser.uid, firebaseUser.email);
    } catch {
      setError('Could not create the team. Please try again.');
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Create team"
        className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-pop"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">Create team</h2>

        <div className={fieldClass}>
          <label htmlFor="team-name" className={labelClass}>
            Name
          </label>
          <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className={fieldClass}>
          <label htmlFor="team-club" className={labelClass}>
            Club
          </label>
          <Input id="team-club" value={club} onChange={(e) => setClub(e.target.value)} required />
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
          <Button variant="primary" type="submit">
            Create
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-right text-sm text-red">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
