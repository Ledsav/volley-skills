import { useState, type FormEvent } from 'react';
import { updatePlayerContact } from './playersApi';
import type { Player } from '../types/player';

interface PlayerContactSectionProps {
  teamId: string;
  playerId: string;
  player: Player;
  onPlayerUpdated: (player: Player) => void;
}

export function PlayerContactSection({ teamId, playerId, player, onPlayerUpdated }: PlayerContactSectionProps) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(player.fullName);
  const [position, setPosition] = useState(player.position);
  const [playerPhone, setPlayerPhone] = useState(player.playerPhone);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    await updatePlayerContact(teamId, playerId, { fullName, position, playerPhone });
    onPlayerUpdated({ ...player, fullName, position, playerPhone });
    setEditing(false);
  }

  if (!editing) {
    return (
      <section className="rounded-lg border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Contact & Registration</h2>
        <p className="mt-3 text-slate">Name: {player.fullName}</p>
        <p className="mt-1 text-slate">Position: {player.position}</p>
        <p className="mt-1 text-slate">Phone: {player.playerPhone}</p>
        <button
          onClick={() => setEditing(true)}
          className="mt-4 rounded-md px-3 py-1.5 text-sm font-medium text-blue hover:bg-blue/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          Edit
        </button>
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
      <input
        id="player-name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
        className="mb-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
      />

      <label htmlFor="player-position" className="mb-1 block text-sm font-medium text-ink">
        Position
      </label>
      <input
        id="player-position"
        value={position}
        onChange={(e) => setPosition(e.target.value)}
        className="mb-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
      />

      <label htmlFor="player-phone" className="mb-1 block text-sm font-medium text-ink">
        Phone
      </label>
      <input
        id="player-phone"
        value={playerPhone}
        onChange={(e) => setPlayerPhone(e.target.value)}
        className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
      />

      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-md bg-navy px-4 py-2 font-medium text-white hover:bg-navy/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md px-4 py-2 font-medium text-slate hover:bg-border/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
