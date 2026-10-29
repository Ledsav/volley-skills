import { useState } from 'react';
import { Input } from '../components/Input';
import { useT } from '../i18n/I18nProvider';
import { useClubFeatures } from '../clubs/useClubFeatures';
import { visibleTestTypes } from '../types/physicalTest';
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
  const s = useT().physicalSessions.roster;
  const [search, setSearch] = useState('');
  const { growthTestsEnabled } = useClubFeatures();
  const visible = visibleTestTypes(growthTestsEnabled);
  const testCount = visible.length;

  const completedCountByPlayer = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status === 'complete' && visible.includes(entry.testType)) {
      completedCountByPlayer.set(entry.playerId, (completedCountByPlayer.get(entry.playerId) ?? 0) + 1);
    }
  }

  if (players.length === 0) {
    return <p className="text-footnote text-ink-2">{s.empty}</p>;
  }

  const filtered = players.filter((p) => p.fullName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full md:w-64 md:shrink-0">
      <label htmlFor="roster-search" className="sr-only">{s.search}</label>
      <Input
        id="roster-search"
        aria-label={s.search}
        autoComplete="off"
        placeholder={s.searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 w-full"
      />
      <ul aria-label={s.playersAria} className="max-h-80 overflow-y-auto rounded-lg bg-surface shadow-card md:max-h-[32rem]">
        {filtered.length === 0 && <li className="px-4 py-3 text-footnote text-ink-2">{s.noMatch}</li>}
        {filtered.map((player) => {
          const count = completedCountByPlayer.get(player.id) ?? 0;
          const selected = selectedPlayerId === player.id;
          return (
            <li key={player.id} className="border-t border-separator first:border-t-0">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(player.id)}
                className={`flex min-h-[52px] w-full items-center gap-3 px-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${
                  selected ? 'bg-surface-3' : 'active:bg-surface-3'
                }`}
              >
                {player.number > 0 && <span className="w-8 shrink-0 text-footnote tabular-nums text-ink-2">#{player.number}</span>}
                <span className="min-w-0 flex-1 truncate text-headline text-ink">{player.fullName}</span>
                <span className="shrink-0 text-footnote tabular-nums text-ink-2">
                  {count}/{testCount}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
