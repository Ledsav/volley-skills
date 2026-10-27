import { Check, ChevronLeft, ChevronRight, CloudOff, MoreHorizontal, Undo2 } from 'lucide-react';
import { Menu, type MenuItem } from '../../components/Menu';
import type { MatchFormat } from '../../types/match';
import { useT } from '../../i18n/I18nProvider';
import type { MatchState } from '../scoutEngine';
import { keyLabel } from './hotkeys';
import { Kbd } from './Kbd';

interface ScoutHeaderProps {
  state: MatchState;
  format: MatchFormat;
  opponent: string;
  pending: number;
  onEditScore: () => void;
  onRotate: (delta: 1 | -1) => void;
  onUndo: () => void;
  /** App tools (modes, panels, exit) — everything that is neither a match event nor a correction. */
  tools: MenuItem[];
  /** No set in play: the engine ignores corrections, so they are unavailable. */
  disabled?: boolean;
}

const CONTROL = 'flex h-11 items-center justify-center rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40';

/**
 * One compact row: match state, then the corrections to it (score — tap to correct —
 * rotation, Undo), then the tools menu. Match events live in the bottom dock.
 * Kept to a single row so the court gets the screen.
 */
export function ScoutHeader({ state, format, opponent, pending, onEditScore, onRotate, onUndo, tools, disabled = false }: ScoutHeaderProps) {
  const t = useT().scout.header;
  const serving = state.serving === 'us';
  return (
    <header className="flex items-center gap-2 bg-navy px-3 py-1.5 text-white sm:px-4">
      <button type="button" onClick={onEditScore} aria-label={t.correctScore} disabled={disabled} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="text-2xl font-bold tabular-nums leading-tight">
            {state.score.us}–{state.score.them}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${serving ? 'bg-orange-strong' : 'bg-white/20'}`}>
            {serving ? t.serve : t.receive}
          </span>
        </span>
        <span className="block truncate text-xs text-white/80">
          {t.status(state.set || 1, state.setsWon.us, state.setsWon.them, state.subsUsed, format.subsPerSet, opponent)}
        </span>
      </button>

      {/* Corrections */}
      <span className="flex shrink-0 items-center">
        <button type="button" aria-label={t.prevRotation} onClick={() => onRotate(-1)} disabled={disabled} className={`${CONTROL} w-9`}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="min-w-[3.25rem] text-center text-sm font-medium tabular-nums">{t.rotation(state.rotation)}</span>
        <button type="button" aria-label={t.nextRotation} onClick={() => onRotate(1)} disabled={disabled} className={`${CONTROL} w-9`}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </span>
      <button type="button" onClick={onUndo} aria-label={t.undo} className={`${CONTROL} shrink-0 gap-1.5 px-3 text-sm font-medium`}>
        <Undo2 size={16} aria-hidden="true" />
        <span className="hidden sm:inline">{t.undo}</span>
        <Kbd>{keyLabel('undo')}</Kbd>
      </button>

      <span className="hidden shrink-0 items-center gap-1 text-xs text-white/80 sm:flex" aria-live="polite">
        {pending > 0 ? (
          <>
            <CloudOff size={14} aria-hidden="true" /> {t.pending(pending)}
          </>
        ) : (
          <>
            <Check size={14} aria-hidden="true" /> {t.synced}
          </>
        )}
      </span>
      {pending > 0 && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-white/80 sm:hidden" aria-label={t.pending(pending)}>
          <CloudOff size={14} aria-hidden="true" />
          {pending}
        </span>
      )}

      <Menu label={t.tools} trigger={<MoreHorizontal size={20} aria-hidden="true" />} triggerClassName={`${CONTROL} w-11 shrink-0`} items={tools} />
    </header>
  );
}
