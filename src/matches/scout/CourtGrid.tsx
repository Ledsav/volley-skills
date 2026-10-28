import { Volleyball } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import type { LiberoConfig, RoleMap, RosterEntry } from '../../types/match';
import { useT } from '../../i18n/I18nProvider';
import { shortNames } from '../format';
import { RoleChip } from './RoleChip';

interface CourtGridProps {
  court: string[];
  roster: Map<string, RosterEntry>;
  /** Per-set roles (falls back to the roster role). */
  roles?: RoleMap;
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
  /** We hold serve: the P1 tile carries the serve marker. */
  servingUs?: boolean;
}

// Seen from behind our baseline: front row P4 P3 P2 (net side), back row P5 P6 P1.
const FRONT_ZONES = [3, 2, 1];
const BACK_ZONES = [4, 5, 0];
const LONG_PRESS_MS = 500;
// 'serving' liberos come on when we serve, i.e. to defend (tile labels: t.scout.court.liberoTile).

export function CourtGrid({ court, roster, roles, liberos, activeLiberoId, selectedId, autoSelected = false, form, onSelect, onLongPress, disabled = false, servingUs = false }: CourtGridProps) {
  const t = useT();
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const names = useMemo(() => shortNames([...roster.values()]), [roster]);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clear, []);

  // Card hierarchy: name first, then jersey number and role side by side; the zone belongs to the court, so it stays quiet.
  const tile = (zone: number) => {
    const id = court[zone];
    const entry = id ? roster.get(id) : undefined;
    const serves = servingUs && zone === 0;
    const zoneLabel = (muted: string) => (
      <span className={`absolute left-1.5 top-1 flex items-center gap-1 text-[11px] font-medium leading-4 ${muted}`}>
        P{zone + 1}
        {serves && <Volleyball size={12} aria-hidden="true" />}
      </span>
    );
    if (!entry) {
      return (
        <div key={zone} className="relative min-h-20 rounded-md border border-dashed border-border">
          {zoneLabel('text-slate')}
        </div>
      );
    }
    const isLibero = id === activeLiberoId;
    const isSelected = selectedId === id;
    const f = form(id);
    const note = [serves ? t.scout.court.serving : null, f ? t.scout.court.form[f] : null].filter(Boolean).join(' · ');
    return (
      <button
        key={zone}
        type="button"
        aria-label={t.scout.court.player(entry.number, entry.name, isLibero)}
        title={note || undefined}
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
        className={`relative flex min-h-20 min-w-0 select-none flex-col items-center justify-center gap-1 rounded-md border px-1 pb-1.5 pt-5 disabled:opacity-60 ${
          isSelected
            ? 'border-blue-strong bg-blue-strong text-on-ink shadow-card ring-2 ring-blue-strong'
            : isLibero
              ? 'border-orange bg-orange/20 text-ink'
              : 'border-border bg-surface text-ink shadow-card'
        }`}
      >
        {zoneLabel(isSelected ? 'text-on-ink/75' : 'text-slate')}
        <span className="absolute right-1.5 top-1 flex items-center gap-1">
          {isSelected && autoSelected && (
            <span aria-hidden="true" className="rounded-sm bg-on-ink/20 px-1 text-[11px] font-medium leading-4 text-on-ink">
              {t.scout.court.auto}
            </span>
          )}
          {f && (
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${f === 'bad' ? 'bg-red' : 'bg-green'} ${isSelected ? 'ring-2 ring-white' : ''}`} />
          )}
        </span>
        <span className="max-w-full truncate text-base font-bold leading-tight sm:text-lg">{names.get(id) ?? entry.name}</span>
        <span className="flex items-center gap-1.5">
          <span className="text-base font-bold tabular-nums leading-none">#{entry.number}</span>
          <RoleChip
            role={isLibero ? 'L' : (roles?.[id] ?? entry.positionCategory)}
            label={isLibero ? t.scout.court.liberoTile[liberos.find((l) => l.playerId === id)?.mode ?? 'always'] : undefined}
            libero={isLibero}
            inverted={isSelected}
          />
        </span>
      </button>
    );
  };

  return (
    <div className="rounded-lg border-2 border-orange-strong bg-orange/10 p-2">
      <div className="mb-2 flex items-center gap-2" aria-hidden="true">
        <span className="h-1 flex-1 rounded-full bg-ink" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate">{t.scout.court.net}</span>
        <span className="h-1 flex-1 rounded-full bg-ink" />
      </div>
      <div className="grid grid-cols-3 gap-2">{FRONT_ZONES.map(tile)}</div>
      {/* The attack line: front row above, back row below. */}
      <div className="my-2 border-t-2 border-dashed border-orange-strong/40" aria-hidden="true" />
      <div className="grid grid-cols-3 gap-2">{BACK_ZONES.map(tile)}</div>
    </div>
  );
}
