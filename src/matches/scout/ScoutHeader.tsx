import { ChevronLeft, ChevronRight, CloudOff, Check } from 'lucide-react';
import type { MatchFormat } from '../../types/match';
import type { MatchState } from '../scoutEngine';

interface ScoutHeaderProps {
  state: MatchState;
  format: MatchFormat;
  opponent: string;
  pending: number;
  onEditScore: () => void;
  onRotate: (delta: 1 | -1) => void;
  /** No set in play: the engine ignores corrections, so they are unavailable. */
  disabled?: boolean;
}

function Dots({ used, total }: { used: number; total: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${i < total - used ? 'bg-white' : 'bg-white/30'}`} />
      ))}
    </span>
  );
}

export function ScoutHeader({ state, format, opponent, pending, onEditScore, onRotate, disabled = false }: ScoutHeaderProps) {
  return (
    <header className="bg-navy px-3 py-2 text-white sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onEditScore} aria-label="Correct score" disabled={disabled} className="text-left">
          <span className="block text-3xl font-bold tabular-nums leading-tight">
            {state.score.us}–{state.score.them}
          </span>
          <span className="block text-xs text-white/80">
            Set {state.set || 1} · sets {state.setsWon.us}–{state.setsWon.them} · vs {opponent}
          </span>
        </button>
        <div className="flex flex-col items-end gap-1 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${state.serving === 'us' ? 'bg-orange' : 'bg-white/20'}`}>
            {state.serving === 'us' ? '● We serve' : '○ We receive'}
          </span>
          <span className="flex items-center gap-1">
            <button type="button" aria-label="Previous rotation" onClick={() => onRotate(-1)} disabled={disabled} className="flex h-11 w-11 items-center justify-center rounded-md bg-white/10 disabled:opacity-40">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="tabular-nums">Rot {state.rotation}</span>
            <button type="button" aria-label="Next rotation" onClick={() => onRotate(1)} disabled={disabled} className="flex h-11 w-11 items-center justify-center rounded-md bg-white/10 disabled:opacity-40">
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </span>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/80">
        <span className="tabular-nums">Subs {state.subsUsed}/{format.subsPerSet}</span>
        <span className="flex items-center gap-1">T/O us <Dots used={state.timeoutsUsed.us} total={format.timeoutsPerSet} /></span>
        <span className="flex items-center gap-1">them <Dots used={state.timeoutsUsed.them} total={format.timeoutsPerSet} /></span>
        <span className="ml-auto flex items-center gap-1" aria-live="polite">
          {pending > 0 ? (
            <><CloudOff size={14} aria-hidden="true" /> {pending} pending</>
          ) : (
            <><Check size={14} aria-hidden="true" /> synced</>
          )}
        </span>
      </div>
    </header>
  );
}
