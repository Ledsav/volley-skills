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
  /** Set when Undo has nothing it may remove (only imported events): disables it and explains why. */
  undoHint: string | null;
  /** App tools (modes, panels, exit) — everything that is neither a match event nor a correction. */
  tools: MenuItem[];
  /** No set in play: the engine ignores corrections, so they are unavailable. */
  disabled?: boolean;
}

const CONTROL = 'flex h-11 items-center justify-center rounded-md hover:bg-surface-2 disabled:opacity-40';

/**
 * Two rows. Row 1: sync state, who serves, the status line, the live tag (from md) and the tools menu.
 * Row 2 is the split score: our score at the left edge, theirs at the right, and between them the
 * corrections (rotation, Undo with its hint). Tap either score to correct it. Match events live in the
 * bottom dock, never here.
 */
export function ScoutHeader({ state, format, opponent, pending, onEditScore, onRotate, onUndo, undoHint, tools, disabled = false }: ScoutHeaderProps) {
  const t = useT().scout.header;
  const serving = state.serving === 'us';
  return (
    <header className="shrink-0 border-b border-separator bg-bg pt-[env(safe-area-inset-top)]">
      <div className="flex h-11 items-center gap-2 pl-3 pr-1 sm:pl-4">
        <span className="hidden shrink-0 items-center gap-1 text-footnote text-ink-2 sm:flex" aria-live="polite">
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
          <span className="flex shrink-0 items-center gap-1 text-footnote text-ink-2 sm:hidden" aria-label={t.pending(pending)}>
            <CloudOff size={14} aria-hidden="true" />
            {pending}
          </span>
        )}
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-caption ${serving ? 'bg-ink text-on-ink' : 'bg-surface-2 text-ink-2'}`}>
          {serving ? t.serve : t.receive}
        </span>
        <p className="min-w-0 flex-1 truncate text-footnote text-ink-2">
          {t.status(state.set || 1, state.setsWon.us, state.setsWon.them, state.subsUsed, format.subsPerSet, opponent)}
        </p>
        <span data-testid="live-tag" className="hidden shrink-0 rounded-full bg-red-tint px-2.5 py-0.5 text-caption text-red-strong md:inline-flex">
          {t.live(state.set || 1)}
        </span>
        <Menu label={t.tools} trigger={<MoreHorizontal size={20} aria-hidden="true" />} triggerClassName={`${CONTROL} w-11 shrink-0`} items={tools} />
      </div>

      <div className="relative h-14 px-3 sm:px-4 md:[@media(min-height:561px)]:h-[4.5rem]">
        {/* Score: tap to correct. The middle spacer leaves room for the corrections laid over it. */}
        <button
          type="button"
          onClick={onEditScore}
          aria-label={t.correctScore}
          disabled={disabled}
          className="flex h-full w-full items-center justify-between whitespace-nowrap rounded-md tabular-nums"
        >
          <span className="text-score text-ink">{state.score.us}</span>
          <span aria-hidden="true" className="w-[11.75rem] shrink-0 sm:w-64" />
          <span className="text-score text-ink-2">{state.score.them}</span>
        </button>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-full justify-center">
          <div className="pointer-events-auto flex w-[11.75rem] flex-col items-center justify-center sm:w-64">
            <span className="flex items-center gap-1">
              <button type="button" aria-label={t.prevRotation} onClick={() => onRotate(-1)} disabled={disabled} className={`${CONTROL} w-11 bg-surface-2`}>
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <span className="min-w-9 text-center text-footnote font-medium tabular-nums text-ink-2">{t.rotation(state.rotation)}</span>
              <button type="button" aria-label={t.nextRotation} onClick={() => onRotate(1)} disabled={disabled} className={`${CONTROL} w-11 bg-surface-2`}>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onUndo}
                aria-label={t.undo}
                disabled={undoHint !== null}
                aria-describedby={undoHint !== null ? 'undo-hint' : undefined}
                className="ml-1 flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-surface-2 px-3 text-callout font-medium text-ink disabled:opacity-40"
              >
                <Undo2 size={16} aria-hidden="true" />
                <span className="hidden sm:inline">{t.undo}</span>
                <Kbd>{keyLabel('undo')}</Kbd>
              </button>
            </span>
            {undoHint !== null && (
              <span id="undo-hint" title={undoHint} className="max-w-full truncate text-caption leading-3 text-ink-2">
                {undoHint}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
