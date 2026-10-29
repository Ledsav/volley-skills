import { Volleyball } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import type { LiberoConfig, RoleMap, RosterEntry } from '../../types/match';
import { useT } from '../../i18n/I18nProvider';
import { tapFlash } from '../../motion/tapFlash';
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
  /** Tight height (action panel open on a phone, landscape phone): 56 px tiles and tighter gaps. */
  compact?: boolean;
}

// Seen from behind our baseline: front row P4 P3 P2 (net side), back row P5 P6 P1.
const FRONT_ZONES = [3, 2, 1];
const BACK_ZONES = [4, 5, 0];
const LONG_PRESS_MS = 500;
// 'serving' liberos come on when we serve, i.e. to defend (tile labels: t.scout.court.liberoTile).

export function CourtGrid({ court, roster, roles, liberos, activeLiberoId, selectedId, autoSelected = false, form, onSelect, onLongPress, disabled = false, servingUs = false, compact = false }: CourtGridProps) {
  const t = useT();
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const names = useMemo(() => shortNames([...roster.values()]), [roster]);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clear, []);

  // Tile hierarchy, the same spot on every tile so the eye learns it: role badge then jersey number on the
  // first line, the name (the largest text) under them; markers (auto, form) top right; the court zone
  // belongs to the court, so it stays a quiet label in the bottom-right corner.
  const tile = (zone: number) => {
    const id = court[zone];
    const entry = id ? roster.get(id) : undefined;
    const serves = servingUs && zone === 0;
    const zoneLabel = (muted: string) => (
      <span className={`absolute bottom-1 right-1.5 flex items-center gap-1 text-[11px] font-medium leading-4 ${muted}`}>
        P{zone + 1}
        {serves && <Volleyball size={12} aria-hidden="true" />}
      </span>
    );
    if (!entry) {
      return (
        <div key={zone} className={`relative ${compact ? 'min-h-14' : 'min-h-[72px] md:min-h-20'} rounded-md border border-dashed border-separator`}>
          {zoneLabel('text-ink-2')}
        </div>
      );
    }
    const isLibero = id === activeLiberoId;
    const isSelected = selectedId === id;
    // The server: P1 while we serve, otherwise the on-court setter by per-set role.
    const isServer = servingUs ? zone === 0 : !isLibero && (roles?.[id] ?? entry.positionCategory) === 'S';
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
        onPointerDown={(e) => {
          if (disabled) return;
          tapFlash(e.currentTarget);
          longPressed.current = false;
          timer.current = window.setTimeout(() => {
            longPressed.current = true;
            navigator.vibrate?.(10);
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
        className={`relative flex ${compact ? 'min-h-14' : 'min-h-[72px] md:min-h-20'} min-w-0 select-none flex-col items-start justify-center ${compact ? 'gap-0.5' : 'gap-1 md:gap-1.5'} rounded-md ${compact ? 'px-2 py-1' : 'px-2.5 py-2 md:px-4'} text-left text-ink disabled:opacity-60 ${
          isSelected ? 'bg-surface-3 ring-2 ring-ink' : isLibero ? 'bg-orange-tint' : 'bg-surface'
        } ${isServer && !isSelected ? 'ring-2 ring-inset ring-surface-3' : ''}`}
      >
        {zoneLabel('text-ink-2')}
        <span className="absolute right-1.5 top-1 flex items-center gap-1">
          {isSelected && autoSelected && (
            <span aria-hidden="true" className="rounded-sm bg-ink px-1 text-[11px] font-medium leading-4 text-on-ink">
              {t.scout.court.auto}
            </span>
          )}
          {f && (
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${f === 'bad' ? 'bg-red' : 'bg-green'}`} />
          )}
        </span>
        <span className={`flex max-w-full items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
          <RoleChip
            variant="badge"
            selected={isSelected}
            role={isLibero ? 'L' : (roles?.[id] ?? entry.positionCategory)}
            label={isLibero ? t.scout.court.liberoTile[liberos.find((l) => l.playerId === id)?.mode ?? 'always'] : undefined}
            libero={isLibero}
          />
          <span className={`font-bold tabular-nums leading-none text-ink ${compact ? 'text-callout' : 'text-headline md:text-title-3 xl:text-title-2'}`}>
            #{entry.number}
          </span>
        </span>
        {/* The name never wraps into the badge line: one line, truncated, clear of the zone label. */}
        <span className={`max-w-full truncate pr-5 text-left ${compact ? 'text-headline' : 'text-title-3 md:text-title-2 xl:text-title-1'}`}>
          {names.get(id) ?? entry.name}
        </span>
      </button>
    );
  };

  return (
    // From md the court fills the height it is given but stops growing at 30rem, so tiles stay a sensible size.
    <div className="flex min-h-0 flex-1 flex-col md:max-h-[30rem]">
      <div className={`${compact ? 'mb-1' : 'mb-2'} flex items-center gap-2`} aria-hidden="true">
        <span className="h-1 flex-1 rounded-full bg-ink" />
        <span className="text-caption text-ink-2">{t.scout.court.net}</span>
        <span className="h-1 flex-1 rounded-full bg-ink" />
      </div>
      <div className="grid flex-1 grid-cols-3 grid-rows-[1fr] gap-2">{FRONT_ZONES.map(tile)}</div>
      {/* The attack line: front row above, back row below. */}
      <div className={`${compact ? 'my-1' : 'my-2'} border-t-2 border-dashed border-separator`} aria-hidden="true" />
      <div className="grid flex-1 grid-cols-3 grid-rows-[1fr] gap-2">{BACK_ZONES.map(tile)}</div>
    </div>
  );
}
