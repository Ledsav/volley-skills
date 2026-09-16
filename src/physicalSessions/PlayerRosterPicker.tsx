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
  const [open, setOpen] = useState(false);

  const completedCountByPlayer = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status === 'complete') {
      completedCountByPlayer.set(entry.playerId, (completedCountByPlayer.get(entry.playerId) ?? 0) + 1);
    }
  }

  const filtered = players.filter((p) => p.fullName.toLowerCase().includes(search.toLowerCase()));
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) ?? null;
  const displayValue = open ? search : selectedPlayer ? `#${selectedPlayer.number} ${selectedPlayer.fullName}` : '';

  function selectPlayer(playerId: string) {
    onSelect(playerId);
    setSearch('');
    setOpen(false);
  }

  return (
    <div className="relative w-full">
      <label htmlFor="roster-search" className="sr-only">Search players</label>
      <Input
        id="roster-search"
        aria-label="Search players"
        role="combobox"
        aria-expanded={open}
        aria-controls="roster-search-listbox"
        autoComplete="off"
        placeholder="Search players..."
        value={displayValue}
        onFocus={() => {
          setSearch('');
          setOpen(true);
        }}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        className="w-full"
      />
      {open && (
        <ul
          id="roster-search-listbox"
          role="listbox"
          className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-pop"
        >
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate">No players match.</li>}
          {filtered.map((player) => {
            const count = completedCountByPlayer.get(player.id) ?? 0;
            return (
              <li key={player.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedPlayerId === player.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectPlayer(player.id);
                  }}
                  className={`flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left ${
                    selectedPlayerId === player.id ? 'bg-blue/10' : 'hover:bg-blue/5'
                  }`}
                >
                  <span className="text-sm text-ink">#{player.number}</span>
                  <span className="truncate text-sm text-ink">{player.fullName}</span>
                  <span className="shrink-0 tabular-nums text-xs text-slate">
                    {count}/{PHYSICAL_TEST_ORDER.length}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
