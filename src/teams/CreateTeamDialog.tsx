import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createTeam } from './teamsApi';

interface CreateTeamDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue';
const labelClass = 'mb-1 block text-sm font-medium text-ink';
const fieldClass = 'mb-4';

export function CreateTeamDialog({ onClose, onCreated }: CreateTeamDialogProps) {
  const { firebaseUser } = useAuth();
  const [name, setName] = useState('');
  const [club, setClub] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [season, setSeason] = useState('');
  const [description, setDescription] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!firebaseUser?.email) return;
    await createTeam({ name, club, ageGroup, season, description }, firebaseUser.uid, firebaseUser.email);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
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
          <input id="team-name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </div>

        <div className={fieldClass}>
          <label htmlFor="team-club" className={labelClass}>
            Club
          </label>
          <input id="team-club" value={club} onChange={(e) => setClub(e.target.value)} required className={inputClass} />
        </div>

        <div className={fieldClass}>
          <label htmlFor="team-age-group" className={labelClass}>
            Age group
          </label>
          <input
            id="team-age-group"
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label htmlFor="team-season" className={labelClass}>
            Season
          </label>
          <input id="team-season" value={season} onChange={(e) => setSeason(e.target.value)} required className={inputClass} />
        </div>

        <div className={fieldClass}>
          <label htmlFor="team-description" className={labelClass}>
            Description
          </label>
          <textarea
            id="team-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} min-h-[80px] resize-y`}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-blue px-4 py-2 font-medium text-blue hover:bg-blue/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-navy px-4 py-2 font-medium text-white hover:bg-navy/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
