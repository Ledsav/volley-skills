import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Input, FIELD_CLASS } from '../components/Input';
import { useSave } from '../components/useSave';
import { createPlayer } from './playersApi';
import { POSITION_CATEGORIES, SHIRT_SIZES, type Guardian, type PositionCategory, type ShirtSize } from '../types/player';
import type { Team } from '../types/team';
import { useT } from '../i18n/I18nProvider';

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
  const lb = useT().labels;
  const { firebaseUser, appUser } = useAuth();
  const [number, setNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [positionCategory, setPositionCategory] = useState<PositionCategory>('TBD');
  const [shirtSize, setShirtSize] = useState<ShirtSize | ''>('');
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

  const { saving, save } = useSave();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!firebaseUser || !appUser || !consentGiven) return;
    const { uid } = firebaseUser;
    const email = appUser.email;
    try {
      const done = await save(() => createPlayer(
        teamId,
        team,
        {
          number: Number(number),
          fullName,
          dob,
          nationality,
          licenseNumber,
          positionCategory,
          shirtSize,
          playerPhone,
          guardians,
        },
        uid,
        email
      ));
      if (!done) return;
    } catch {
      setError('Could not create the player. Please try again.');
      return;
    }
    onCreated();
  }

  return (
    <Dialog title="Add player" onClose={onClose} guardUnsaved size="lg" mobileSheet>
      <form onSubmit={handleSubmit} aria-label="Add player">

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
          <label htmlFor="player-position-category" className={labelClass}>
            Position
          </label>
          <select
            id="player-position-category"
            className={FIELD_CLASS}
            value={positionCategory}
            onChange={(e) => setPositionCategory(e.target.value as PositionCategory)}
          >
            {POSITION_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {lb.position[c.value]('mixed') /* TODO(i18n T8): teamGender(team) */}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-shirt-size" className={labelClass}>
            Shirt size
          </label>
          <select
            id="player-shirt-size"
            className={FIELD_CLASS}
            value={shirtSize}
            onChange={(e) => setShirtSize(e.target.value as ShirtSize | '')}
          >
            <option value="">Not set</option>
            {SHIRT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
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
          I confirm a parent or legal guardian has consented to storing this player's data, including physical-test measurements and match statistics.
        </label>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
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
