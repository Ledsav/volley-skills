import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Input, FIELD_CLASS } from '../components/Input';
import { createPlayer } from './playersApi';
import type { Guardian } from '../types/player';
import type { Team } from '../types/team';

interface AddPlayerDialogProps {
  teamId: string;
  team: Team;
  onClose: () => void;
  onCreated: () => void;
}

const labelClass = 'mb-1 block text-sm font-medium text-ink';
const fieldClass = 'mb-4';

function emptyGuardian(): Guardian {
  return { relation: 'mother', name: '', phone: '', email: '' };
}

export function AddPlayerDialog({ teamId, team, onClose, onCreated }: AddPlayerDialogProps) {
  const { firebaseUser } = useAuth();
  const [number, setNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [position, setPosition] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  const [guardians, setGuardians] = useState<Guardian[]>([emptyGuardian()]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateGuardian(index: number, updates: Partial<Guardian>) {
    setGuardians((current) => current.map((g, i) => (i === index ? { ...g, ...updates } : g)));
  }

  function addGuardian() {
    setGuardians((current) => [...current, emptyGuardian()]);
  }

  function removeGuardian(index: number) {
    setGuardians((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!firebaseUser?.email || !consentGiven) return;
    try {
      await createPlayer(
        teamId,
        team,
        {
          number: Number(number),
          fullName,
          dob,
          nationality,
          licenseNumber,
          position,
          playerPhone,
          guardians,
        },
        firebaseUser.uid,
        firebaseUser.email
      );
    } catch {
      setError('Could not create the player. Please try again.');
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Add player"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface py-6 pl-6 pr-3 shadow-pop [scrollbar-gutter:stable]"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">Add player</h2>

        <div className={fieldClass}>
          <label htmlFor="player-number" className={labelClass}>
            Number
          </label>
          <Input id="player-number" type="number" value={number} onChange={(e) => setNumber(e.target.value)} required />
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-full-name" className={labelClass}>
            Full name
          </label>
          <Input id="player-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-dob" className={labelClass}>
            Date of birth
          </label>
          <Input id="player-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-nationality" className={labelClass}>
            Nationality
          </label>
          <Input id="player-nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} />
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-license" className={labelClass}>
            License #
          </label>
          <Input id="player-license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-position" className={labelClass}>
            Position
          </label>
          <Input id="player-position" value={position} onChange={(e) => setPosition(e.target.value)} />
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-phone" className={labelClass}>
            Phone
          </label>
          <Input id="player-phone" value={playerPhone} onChange={(e) => setPlayerPhone(e.target.value)} />
        </div>

        <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate">Guardians</h3>
        {guardians.map((guardian, index) => (
          <div key={index} className="mb-4 rounded-md border border-border p-3">
            <div className={fieldClass}>
              <label htmlFor={`guardian-relation-${index}`} className={labelClass}>
                Relation
              </label>
              <select
                id={`guardian-relation-${index}`}
                className={FIELD_CLASS}
                value={guardian.relation}
                onChange={(e) => updateGuardian(index, { relation: e.target.value as Guardian['relation'] })}
              >
                <option value="mother">Mother</option>
                <option value="father">Father</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className={fieldClass}>
              <label htmlFor={`guardian-name-${index}`} className={labelClass}>
                Guardian name
              </label>
              <Input
                id={`guardian-name-${index}`}
                value={guardian.name}
                onChange={(e) => updateGuardian(index, { name: e.target.value })}
                required
              />
            </div>
            <div className={fieldClass}>
              <label htmlFor={`guardian-phone-${index}`} className={labelClass}>
                Guardian phone
              </label>
              <Input
                id={`guardian-phone-${index}`}
                value={guardian.phone}
                onChange={(e) => updateGuardian(index, { phone: e.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label htmlFor={`guardian-email-${index}`} className={labelClass}>
                Guardian email
              </label>
              <Input
                id={`guardian-email-${index}`}
                type="email"
                value={guardian.email}
                onChange={(e) => updateGuardian(index, { email: e.target.value })}
              />
            </div>
            {guardians.length > 1 && (
              <Button variant="dangerGhost" size="sm" onClick={() => removeGuardian(index)}>
                Remove guardian
              </Button>
            )}
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addGuardian} className="mb-4">
          + Add guardian
        </Button>

        <label className="mb-4 flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            required
            className="mt-1"
          />
          I confirm parental/guardian consent has been obtained to store this player's data.
        </label>

        <div className="mt-2 flex justify-end gap-3">
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
