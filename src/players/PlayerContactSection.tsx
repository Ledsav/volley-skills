import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Input } from '../components/Input';
import { updatePlayerContact } from './playersApi';
import type { Player } from '../types/player';

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
  const [position, setPosition] = useState(player.position);
  const [playerPhone, setPlayerPhone] = useState(player.playerPhone);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setFullName(player.fullName);
      setPosition(player.position);
      setPlayerPhone(player.playerPhone);
      setError(null);
    }
  }, [editing, player.fullName, player.position, player.playerPhone]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await updatePlayerContact(teamId, playerId, { fullName, position, playerPhone });
    } catch {
      setError('Could not save contact information. Please try again.');
      return;
    }
    onPlayerUpdated({ ...player, fullName, position, playerPhone });
    onEditingChange(false);
  }

  return (
    <div className="flex h-full flex-col">
      <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-slate">Position</dt>
        <dd className="font-medium text-ink">{player.position || '—'}</dd>
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

            <label htmlFor="player-position" className="mb-1 block text-sm font-medium text-ink">
              Position
            </label>
            <Input
              id="player-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="mb-3 w-full"
            />

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
