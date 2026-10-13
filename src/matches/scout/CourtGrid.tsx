import { useEffect, useRef } from 'react';
import type { LiberoConfig, LiberoMode, RosterEntry } from '../../types/match';

interface CourtGridProps {
  court: string[];
  roster: Map<string, RosterEntry>;
  liberos: LiberoConfig[];
  activeLiberoId: string | null;
  selectedId: string | null;
  /** The selection came from auto-select (shows a small "auto" badge). */
  autoSelected?: boolean;
  form: (playerId: string) => 'good' | 'bad' | null;
  onSelect: (playerId: string) => void;
  onLongPress: (playerId: string) => void;
  /** No set in play: tiles are inert (no selection, no long-press). */
  disabled?: boolean;
}

// Seen from behind our baseline: front row P4 P3 P2 (net side), back row P5 P6 P1.
const ZONES = [3, 2, 1, 4, 5, 0];
const LONG_PRESS_MS = 500;
// 'serving' liberos come on when we serve, i.e. to defend.
const LIBERO_TILE_LABEL: Record<LiberoMode, string> = { receiving: 'L·rec', serving: 'L·def', always: 'L' };

export function CourtGrid({ court, roster, liberos, activeLiberoId, selectedId, autoSelected = false, form, onSelect, onLongPress, disabled = false }: CourtGridProps) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clear, []);

  return (
    <div className="rounded-lg border-2 border-orange-strong bg-orange/10 p-2">
      <div className="mb-2 h-1 rounded-full bg-ink" aria-hidden="true" />
      <div className="grid grid-cols-3 gap-2">
        {ZONES.map((zone) => {
          const id = court[zone];
          const entry = id ? roster.get(id) : undefined;
          if (!entry) return <div key={zone} className="min-h-16 rounded-md border border-dashed border-border" />;
          const isLibero = id === activeLiberoId;
          const isSelected = selectedId === id;
          const f = form(id);
          return (
            <button
              key={zone}
              type="button"
              aria-label={`#${entry.number} ${entry.name}${isLibero ? ', libero' : ''}`}
              aria-pressed={isSelected}
              disabled={disabled}
              onPointerDown={() => {
                if (disabled) return;
                longPressed.current = false;
                timer.current = window.setTimeout(() => {
                  longPressed.current = true;
                  onLongPress(id);
                }, LONG_PRESS_MS);
              }}
              onPointerUp={clear}
              onPointerLeave={clear}
              onPointerCancel={clear}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (!disabled && !longPressed.current) onSelect(id);
              }}
              className={`relative flex min-h-16 select-none flex-col items-center justify-center rounded-md border disabled:opacity-60 ${
                isSelected
                  ? 'border-blue-strong bg-blue text-white shadow-card ring-2 ring-blue-strong'
                  : isLibero
                    ? 'border-orange bg-orange/20 text-ink'
                    : 'border-border bg-surface text-ink'
              }`}
            >
              <span className="text-xl font-bold tabular-nums leading-none">{entry.number}</span>
              <span className={`max-w-full truncate px-1 text-xs ${isSelected ? 'text-white' : 'text-slate'}`}>
                {isLibero ? LIBERO_TILE_LABEL[liberos.find((l) => l.playerId === id)?.mode ?? 'always'] : entry.name}
              </span>
              <span className={`absolute left-1 top-1 text-[10px] ${isSelected ? 'text-white/80' : 'text-slate'}`}>P{zone + 1}</span>
              {isSelected && autoSelected && (
                <span aria-hidden="true" className="absolute bottom-1 right-1 rounded-sm bg-white/20 px-1 text-[10px] font-medium leading-tight text-white">
                  auto
                </span>
              )}
              {f && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1 top-1 h-2.5 w-2.5 rounded-full ${f === 'bad' ? 'bg-red' : 'bg-green'} ${isSelected ? 'ring-2 ring-white' : ''}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
