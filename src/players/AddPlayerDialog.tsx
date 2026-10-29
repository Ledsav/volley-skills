import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { Input, FIELD_CLASS, FIELD_LABEL_CLASS } from '../components/Input';
import { useSave } from '../components/useSave';
import { createPlayer } from './playersApi';
import { POSITION_CATEGORIES, SHIRT_SIZES, type Guardian, type PositionCategory, type ShirtSize } from '../types/player';
import type { Team } from '../types/team';
import { useT } from '../i18n/I18nProvider';
import { teamGender } from '../teams/teamGender';

interface AddPlayerDialogProps {
  teamId: string;
  team: Team;
  onClose: () => void;
  onCreated: () => void;
}

const labelClass = FIELD_LABEL_CLASS;
const fieldClass = 'mb-4';

function emptyGuardian(): Guardian {
  return { relation: 'mother', name: '', phone: '', email: '' };
}

export function AddPlayerDialog({ teamId, team, onClose, onCreated }: AddPlayerDialogProps) {
  const t = useT();
  const lb = t.labels;
  const p = t.players;
  const g = teamGender(team);
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
      setError(p.addPlayer.error(g));
      return;
    }
    onCreated();
  }

  return (
    <Sheet
      title={p.addPlayer.title(g)}
      onClose={onClose}
      detent="large"
      guardUnsaved
      confirm={{ label: saving ? p.shared.saving : p.addPlayer.create, form: 'add-player-form', disabled: saving }}
    >
      <form id="add-player-form" onSubmit={handleSubmit} aria-label={p.addPlayer.title(g)}>

        <div className={fieldClass}>
          <label htmlFor="player-full-name" className={labelClass}>
            {p.addPlayer.fullName}
          </label>
          <Input id="player-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        {/* Short fields share a row: the number needs two digits, not a full-width field. */}
        <div className="mb-4 grid grid-cols-[6.5rem_1fr] gap-3">
          <div className="min-w-0">
            <label htmlFor="player-number" className={labelClass}>
              {p.shared.number}
            </label>
            <Input id="player-number" type="number" value={number} onChange={(e) => setNumber(e.target.value)} required />
          </div>
          <div className="min-w-0">
            <label htmlFor="player-position-category" className={labelClass}>
              {p.shared.position}
            </label>
            <select
              id="player-position-category"
              className={`${FIELD_CLASS} w-full`}
              value={positionCategory}
              onChange={(e) => setPositionCategory(e.target.value as PositionCategory)}
            >
              {POSITION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {lb.position[c.value](g)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="player-dob" className={labelClass}>
              {p.addPlayer.dob}
            </label>
            <Input id="player-dob" type="date" className="w-full tabular-nums" value={dob} onChange={(e) => setDob(e.target.value)} required />
          </div>
          <div className="min-w-0">
            <label htmlFor="player-shirt-size" className={labelClass}>
              {p.shared.shirtSize}
            </label>
            <select
              id="player-shirt-size"
              className={`${FIELD_CLASS} w-full`}
              value={shirtSize}
              onChange={(e) => setShirtSize(e.target.value as ShirtSize | '')}
            >
              <option value="">{p.shared.notSet}</option>
              {SHIRT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="player-nationality" className={labelClass}>
              {p.shared.nationality}
            </label>
            <Input id="player-nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </div>
          <div className="min-w-0">
            <label htmlFor="player-license" className={labelClass}>
              {p.addPlayer.licenseNumber}
            </label>
            <Input id="player-license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
          </div>
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-phone" className={labelClass}>
            {p.shared.phone}
          </label>
          <Input id="player-phone" value={playerPhone} onChange={(e) => setPlayerPhone(e.target.value)} />
        </div>

        <h3 className="mb-2 mt-6 text-headline text-ink">{p.addPlayer.guardians}</h3>
        {guardians.map((guardian, index) => (
          <div key={index} className="mb-4 rounded-lg border border-separator p-3">
            <div className={fieldClass}>
              <label htmlFor={`guardian-relation-${index}`} className={labelClass}>
                {p.shared.relation}
              </label>
              <select
                id={`guardian-relation-${index}`}
                className={`${FIELD_CLASS} w-full`}
                value={guardian.relation}
                onChange={(e) => updateGuardian(index, { relation: e.target.value as Guardian['relation'] })}
              >
                <option value="mother">{p.shared.relations.mother}</option>
                <option value="father">{p.shared.relations.father}</option>
                <option value="other">{p.shared.relations.other}</option>
              </select>
            </div>
            <div className={fieldClass}>
              <label htmlFor={`guardian-name-${index}`} className={labelClass}>
                {p.shared.guardianName}
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
                {p.shared.guardianPhone}
              </label>
              <Input
                id={`guardian-phone-${index}`}
                value={guardian.phone}
                onChange={(e) => updateGuardian(index, { phone: e.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label htmlFor={`guardian-email-${index}`} className={labelClass}>
                {p.shared.guardianEmail}
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
                {p.shared.removeGuardian}
              </Button>
            )}
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addGuardian} className="mb-4">
          {p.shared.addGuardian}
        </Button>

        <label className="mb-4 flex items-start gap-2 text-callout text-ink">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            required
            className="mt-1"
          />
          {p.shared.consent(g)}
        </label>

        {error && (
          <p role="alert" className="mt-3 text-callout text-red-strong">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}
