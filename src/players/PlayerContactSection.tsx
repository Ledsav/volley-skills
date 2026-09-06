import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { updatePlayerContact } from './playersApi';
import type { Player } from '../types/player';

interface PlayerContactSectionProps {
  teamId: string;
  playerId: string;
  player: Player;
  onPlayerUpdated: (player: Player) => void;
  isAdmin: boolean;
}

export function PlayerContactSection({
  teamId,
  playerId,
  player,
  onPlayerUpdated,
  isAdmin,
}: PlayerContactSectionProps) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(player.fullName);
  const [position, setPosition] = useState(player.position);
  const [playerPhone, setPlayerPhone] = useState(player.playerPhone);
  const [error, setError] = useState<string | null>(null);

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
    setEditing(false);
  }

  if (!editing || !isAdmin) {
    return (
      <section className="rounded-lg border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Contact & Registration</h2>
        <p className="mt-3 text-slate">Name: {player.fullName}</p>
        <p className="mt-1 text-slate">Position: {player.position}</p>
        <p className="mt-1 text-slate">Phone: {player.playerPhone}</p>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="mt-4">
            Edit
          </Button>
        )}
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      aria-label="Edit contact information"
      className="rounded-lg border border-border bg-surface p-6 shadow-card"
    >
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

      <div className="flex gap-3">
        <Button variant="primary" type="submit">
          Save
        </Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}
    </form>
  );
}
