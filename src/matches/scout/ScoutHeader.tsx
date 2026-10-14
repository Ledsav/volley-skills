import { Check, ChevronLeft, ChevronRight, CloudOff, MoreHorizontal, Undo2 } from 'lucide-react';
import { Menu, type MenuItem } from '../../components/Menu';
import type { MatchFormat } from '../../types/match';
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

/**
 * Match state and the corrections to it: score (tap to correct), serve, rotation,
 * Undo. Match events (points, timeouts) live in the bottom dock; app tools in the ⋯ menu.
 */
export function ScoutHeader({ state, format, opponent, pending, onEditScore, onRotate, onUndo, tools, disabled = false }: ScoutHeaderProps) {
  return (
    <header className="bg-navy px-3 py-2 text-white sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onEditScore} aria-label="Correct score" disabled={disabled} className="min-w-0 text-left">
          <span className="block text-3xl font-bold tabular-nums leading-tight">
            {state.score.us}–{state.score.them}
          </span>
          <span className="block truncate text-xs text-white/80">
            Set {state.set || 1} · sets {state.setsWon.us}–{state.setsWon.them} · vs {opponent}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${state.serving === 'us' ? 'bg-orange-strong' : 'bg-white/20'}`}>
            {state.serving === 'us' ? '● We serve' : '○ We receive'}
          </span>
          <Menu
            label="Match tools"
            trigger={<MoreHorizontal size={20} aria-hidden="true" />}
            triggerClassName="flex h-11 w-11 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
            items={tools}
          />
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/80">
        {/* Corrections: fix where the engine thinks the match is, or take back the last entry. */}
        <span className="flex items-center gap-1">
          <button type="button" aria-label="Previous rotation" onClick={() => onRotate(-1)} disabled={disabled} className="flex h-11 w-11 items-center justify-center rounded-md bg-white/10 disabled:opacity-40">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span className="min-w-[3.25rem] text-center text-sm font-medium tabular-nums text-white">Rot {state.rotation}</span>
          <button type="button" aria-label="Next rotation" onClick={() => onRotate(1)} disabled={disabled} className="flex h-11 w-11 items-center justify-center rounded-md bg-white/10 disabled:opacity-40">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="flex min-h-11 items-center gap-1.5 rounded-md bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
        >
          <Undo2 size={16} aria-hidden="true" /> Undo <Kbd>{keyLabel('undo')}</Kbd>
        </button>
        <span className="ml-auto flex items-center gap-3">
          <span className="tabular-nums">Subs {state.subsUsed}/{format.subsPerSet}</span>
          <span className="flex items-center gap-1" aria-live="polite">
            {pending > 0 ? (
              <>
                <CloudOff size={14} aria-hidden="true" /> {pending} pending
              </>
            ) : (
              <>
                <Check size={14} aria-hidden="true" /> synced
              </>
            )}
          </span>
        </span>
      </div>
    </header>
  );
}
