import { useState } from 'react';
import { Input } from '../components/Input';
import { PHYSICAL_TEST_ORDER } from '../types/physicalTest';
import type { Player } from '../types/player';
import type { TestingSessionEntry } from '../types/testingSession';

interface PlayerRosterPickerProps {
  players: Player[];
  entries: TestingSessionEntry[];
  selectedPlayerId: string | null;
  onSelect: (playerId: string) => void;
}

export function PlayerRosterPicker({ players, entries, selectedPlayerId, onSelect }: PlayerRosterPickerProps) {
  const [search, setSearch] = useState('');

  const completedCountByPlayer = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status === 'complete') {
      completedCountByPlayer.set(entry.playerId, (completedCountByPlayer.get(entry.playerId) ?? 0) + 1);
    }
  }

  const filtered = players.filter((p) => p.fullName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full sm:w-64 sm:shrink-0">
      <label htmlFor="roster-search" className="sr-only">Search players</label>
      <Input
        id="roster-search"
        aria-label="Search players"
        placeholder="Search players..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 w-full"
      />
      <ul className="divide-y divide-border">
        {filtered.map((player) => {
          const count = completedCountByPlayer.get(player.id) ?? 0;
          return (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => onSelect(player.id)}
                className={`flex min-h-11 w-full items-center justify-between gap-2 px-2 py-2 text-left ${
                  selectedPlayerId === player.id ? 'bg-blue/10' : 'hover:bg-blue/5'
                }`}
              >
                <span className="text-sm text-ink">#{player.number}</span>
                <span className="truncate text-sm text-ink">
                  {player.fullName}
                </span>
                <span className="shrink-0 tabular-nums text-xs text-slate">
                  {count}/{PHYSICAL_TEST_ORDER.length}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
