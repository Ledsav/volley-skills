import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Input } from '../components/Input';
import { updatePlayerContact } from './playersApi';
import { POSITION_CATEGORIES, type Player, type PositionCategory } from '../types/player';

const POSITION_LABELS = Object.fromEntries(POSITION_CATEGORIES.map((c) => [c.value, c.label])) as Record<
  PositionCategory,
  string
>;

interface PlayerContactSectionProps {
  teamId: string;
  playerId: string;
  player: Player;
  onPlayerUpdated: (player: Player) => void;
  isAdmin: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

export function PlayerContactSection({
  teamId,
  playerId,
  player,
  onPlayerUpdated,
  isAdmin,
  editing,
  onEditingChange,
}: PlayerContactSectionProps) {
  const [fullName, setFullName] = useState(player.fullName);
  const [shirtNumber, setShirtNumber] = useState(player.number ? String(player.number) : '');
  const [positionCategory, setPositionCategory] = useState<PositionCategory>(player.positionCategory);
  const [starting, setStarting] = useState(player.starting);
  const [playerPhone, setPlayerPhone] = useState(player.playerPhone);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setFullName(player.fullName);
      setShirtNumber(player.number ? String(player.number) : '');
      setPositionCategory(player.positionCategory);
      setStarting(player.starting);
      setPlayerPhone(player.playerPhone);
      setError(null);
    }
  }, [editing, player.fullName, player.number, player.positionCategory, player.starting, player.playerPhone]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const number = Number(shirtNumber) || 0;
    try {
      await updatePlayerContact(teamId, playerId, { fullName, number, positionCategory, starting, playerPhone });
    } catch {
      setError('Could not save contact information. Please try again.');
      return;
    }
    onPlayerUpdated({ ...player, fullName, number, positionCategory, starting, playerPhone });
    onEditingChange(false);
  }

  return (
    <div className="flex h-full flex-col">
      <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-slate">Number</dt>
        <dd className="font-medium tabular-nums text-ink">{player.number ? `#${player.number}` : '—'}</dd>
        <dt className="text-slate">Position</dt>
        <dd className="font-medium text-ink">
          {POSITION_LABELS[player.positionCategory]}
          {player.starting && (
            <span className="ml-2 inline-flex items-center rounded-sm bg-green/10 px-1.5 py-0.5 text-xs font-medium text-green">
              Starting
            </span>
          )}
        </dd>
        <dt className="text-slate">Phone</dt>
        <dd className="font-medium text-ink">{player.playerPhone || '—'}</dd>
        <dt className="text-slate">License</dt>
        <dd className="font-medium tabular-nums text-ink">{player.licenseNumber || '—'}</dd>
        <dt className="text-slate">Nationality</dt>
        <dd className="font-medium text-ink">{player.nationality || '—'}</dd>
      </dl>

      {editing && isAdmin && (
        <Dialog title="Edit contact & registration" onClose={() => onEditingChange(false)}>
          <form onSubmit={handleSave} aria-label="Edit contact information">
            <label htmlFor="player-name" className="mb-1 block text-sm font-medium text-ink">
              Name
            </label>
            <Input
              id="player-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="mb-3 w-full"
            />

            <label htmlFor="player-number" className="mb-1 block text-sm font-medium text-ink">
              Shirt number
            </label>
            <Input
              id="player-number"
              type="number"
              min="0"
              value={shirtNumber}
              onChange={(e) => setShirtNumber(e.target.value)}
              className="mb-3 w-full"
            />

            <label htmlFor="player-position-category" className="mb-1 block text-sm font-medium text-ink">
              Position
            </label>
            <select
              id="player-position-category"
              value={positionCategory}
              onChange={(e) => setPositionCategory(e.target.value as PositionCategory)}
              className="mb-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-blue focus:outline-none"
            >
              {POSITION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <label className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
              <input type="checkbox" checked={starting} onChange={(e) => setStarting(e.target.checked)} />
              Starting player
            </label>

            <label htmlFor="player-phone" className="mb-1 block text-sm font-medium text-ink">
              Phone
            </label>
            <Input
              id="player-phone"
              value={playerPhone}
              onChange={(e) => setPlayerPhone(e.target.value)}
              className="mb-4 w-full"
            />

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => onEditingChange(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save
              </Button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red">
                {error}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </div>
  );
}
