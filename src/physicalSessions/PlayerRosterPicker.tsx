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

/**
 * The session's roster, always visible: tap a player to record their tests.
 * Search only filters the list (it used to be a dropdown, which made a live
 * session look empty until the field was focused).
 */
export function PlayerRosterPicker({ players, entries, selectedPlayerId, onSelect }: PlayerRosterPickerProps) {
  const [search, setSearch] = useState('');

  const completedCountByPlayer = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status === 'complete') {
      completedCountByPlayer.set(entry.playerId, (completedCountByPlayer.get(entry.playerId) ?? 0) + 1);
    }
  }

  if (players.length === 0) {
    return <p className="text-sm text-slate">No players in this team yet. Add them in the Roster tab.</p>;
  }

  const filtered = players.filter((p) => p.fullName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full sm:w-64 sm:shrink-0">
      <label htmlFor="roster-search" className="sr-only">Search players</label>
      <Input
        id="roster-search"
        aria-label="Search players"
        autoComplete="off"
        placeholder="Search players..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 w-full"
      />
      <ul aria-label="Players" className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border sm:max-h-[32rem]">
        {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate">No players match.</li>}
        {filtered.map((player) => {
          const count = completedCountByPlayer.get(player.id) ?? 0;
          const selected = selectedPlayerId === player.id;
          return (
            <li key={player.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(player.id)}
                className={`flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left ${
                  selected ? 'bg-blue/10' : 'hover:bg-blue/5'
                }`}
              >
                {player.number > 0 && <span className="w-7 shrink-0 tabular-nums text-sm text-slate">#{player.number}</span>}
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{player.fullName}</span>
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
