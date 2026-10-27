import { useEffect, useRef, useState } from 'react';
import { getT } from '../../i18n/I18nProvider';
import {
  EMPTY_JERSEY,
  isTypingTarget,
  jerseyReducer,
  resolveKey,
  type Command,
  type HotkeyContext,
  type JerseyAction,
  type JerseyBuffer,
} from './hotkeys';

const HINT_MS = 1_500;

export interface ScoutHotkeysOptions {
  /** Page state the keys depend on (typing, open modals and the jersey buffer are tracked here). */
  context: Omit<HotkeyContext, 'typing' | 'dialogOpen' | 'jerseyPending'>;
  /** Jersey numbers of the whole match roster (court + bench, liberos included). */
  jerseyNumbers: readonly number[];
  /** Every command except jersey input, routed to the page's own handlers. */
  onCommand: (command: Command) => void;
  /** A typed jersey number resolved to exactly one player. */
  onJersey: (number: number) => void;
}

/** A modal layer is open (the set-point prompt is not modal and does not count). */
function modalOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]') !== null;
}

/**
 * Window keydown listener for the scouting screen. Resolves keys with
 * `resolveKey`, owns the jersey-number buffer and its idle timer, and returns
 * a short hint to show (digits being typed, or an unknown number).
 */
export function useScoutHotkeys(options: ScoutHotkeysOptions): { hint: string | null } {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const bufferRef = useRef<JerseyBuffer>(EMPTY_JERSEY);
  const idleTimer = useRef<number | null>(null);
  const hintTimer = useRef<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const clearTimer = (t: { current: number | null }) => {
      if (t.current !== null) window.clearTimeout(t.current);
      t.current = null;
    };

    const flash = (text: string | null, sticky: boolean) => {
      clearTimer(hintTimer);
      setHint(text);
      if (text && !sticky) hintTimer.current = window.setTimeout(() => setHint(null), HINT_MS);
    };

    const step = (action: JerseyAction) => {
      const { buffer, select, unknown } = jerseyReducer(bufferRef.current, action, optionsRef.current.jerseyNumbers);
      bufferRef.current = buffer;
      clearTimer(idleTimer);
      if (buffer.deadline !== null) {
        idleTimer.current = window.setTimeout(() => step({ type: 'tick', now: Date.now() }), Math.max(0, buffer.deadline - Date.now()));
      }
      if (unknown) flash(getT().scout.hotkeys.noPlayer(unknown), false);
      else if (buffer.digits) flash(`#${buffer.digits}…`, true);
      else flash(null, false);
      if (select !== null) optionsRef.current.onJersey(select);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const { context, onCommand } = optionsRef.current;
      const command = resolveKey(event, {
        ...context,
        typing: isTypingTarget(event.target) || isTypingTarget(document.activeElement),
        dialogOpen: modalOpen(),
        jerseyPending: bufferRef.current.digits !== '',
      });
      if (!command) return;
      event.preventDefault();
      switch (command.type) {
        case 'digit':
          step({ type: 'digit', digit: command.digit, now: Date.now() });
          return;
        case 'commitJersey':
          step({ type: 'commit' });
          return;
        case 'jerseyBackspace':
          step({ type: 'backspace', now: Date.now() });
          return;
        case 'close':
          if (bufferRef.current.digits) step({ type: 'clear' });
          onCommand(command);
          return;
        default:
          // Any other command abandons a half-typed number.
          if (bufferRef.current.digits) step({ type: 'clear' });
          onCommand(command);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimer(idleTimer);
      clearTimer(hintTimer);
    };
  }, []);

  return { hint };
}
