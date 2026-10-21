import { GRADES, SKILLS, type Grade, type Side, type Skill } from '../../types/match';
import { validGrades } from '../skillGrades';

/**
 * Keyboard shortcuts for the live scouting screen. KEY_MAP is the single
 * source for the handler (`resolveKey`), the on-screen badges and the cheat
 * sheet. Everything here is pure; the window listener lives in useScoutHotkeys.
 */

type HotkeyId =
  | 'grade'
  | 'skill'
  | 'player'
  | 'pointUs'
  | 'pointThem'
  | 'reason'
  | 'timeoutUs'
  | 'timeoutThem'
  | 'undo'
  | 'close'
  | 'sub'
  | 'auto'
  | 'help';

type HotkeyGroup = 'Record' | 'Rally' | 'General';

interface KeyBinding {
  id: HotkeyId;
  /** Display labels, first one is the badge. */
  keys: readonly string[];
  description: string;
  group: HotkeyGroup;
}

/** Grade keys are the produced characters, so any layout works. */
export const GRADE_KEYS: readonly Grade[] = GRADES;
/** Fundamental keys, matched case-insensitively. */
export const SKILL_KEYS: readonly Skill[] = SKILLS;

export const HOTKEY_GROUPS: readonly HotkeyGroup[] = ['Record', 'Rally', 'General'];

export const KEY_MAP: readonly KeyBinding[] = [
  { id: 'player', keys: ['0–9'], description: 'Select a player by jersey number (Enter to confirm a shorter number)', group: 'Record' },
  { id: 'skill', keys: SKILL_KEYS, description: 'Switch the fundamental on the open action panel', group: 'Record' },
  { id: 'grade', keys: GRADE_KEYS, description: 'Grade the action (only grades valid for the fundamental)', group: 'Record' },
  { id: 'sub', keys: ['Shift+S'], description: 'Substitute the selected player', group: 'Record' },
  { id: 'close', keys: ['Esc'], description: 'Close the action panel / cancel a jersey number', group: 'Record' },
  { id: 'pointUs', keys: ['P'], description: 'Point us', group: 'Rally' },
  { id: 'pointThem', keys: ['O'], description: 'Point them', group: 'Rally' },
  { id: 'reason', keys: ['1–4'], description: 'Pick the point reason while the reason chips show', group: 'Rally' },
  { id: 'timeoutUs', keys: ['T'], description: 'Timeout us', group: 'Rally' },
  { id: 'timeoutThem', keys: ['Shift+T'], description: 'Timeout them', group: 'Rally' },
  { id: 'undo', keys: ['Ctrl+Z', 'Backspace'], description: 'Undo the last action', group: 'General' },
  { id: 'auto', keys: ['Shift+A'], description: 'Toggle auto-select of the next player', group: 'General' },
  { id: 'help', keys: ['?'], description: 'Show or hide this list', group: 'General' },
];

/** The badge label for a binding (its first key). */
export function keyLabel(id: HotkeyId): string {
  return KEY_MAP.find((b) => b.id === id)?.keys[0] ?? '';
}

export type Command =
  | { type: 'grade'; grade: Grade }
  | { type: 'skill'; skill: Skill }
  | { type: 'digit'; digit: string }
  | { type: 'commitJersey' }
  | { type: 'jerseyBackspace' }
  | { type: 'point'; winner: Side }
  | { type: 'reason'; index: number }
  | { type: 'timeout'; team: Side }
  | { type: 'undo' }
  | { type: 'close' }
  | { type: 'sub' }
  | { type: 'toggleAuto' }
  | { type: 'toggleHelp' }
  | { type: 'closeHelp' };

interface KeyLike {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export interface HotkeyContext {
  /** A set is in play: nothing records otherwise (Undo still works). */
  inSet: boolean;
  /** Focus is in an input/select/textarea/contenteditable. */
  typing: boolean;
  /** A modal (dialog/alertdialog) other than the cheat sheet is open. */
  dialogOpen: boolean;
  /** The cheat sheet is open. */
  helpOpen: boolean;
  /** Active fundamental on the open action panel, null when no panel. */
  panelSkill: Skill | null;
  /** Fundamentals offered for the selected player (libero excludes S/A/B). */
  panelSkills: readonly Skill[];
  /** A non-libero player is selected. */
  canSub: boolean;
  /** Number of point-reason chips showing (0 = none). */
  reasonCount: number;
  /** Jersey digits are buffered. */
  jerseyPending: boolean;
}

const MAX_REASON_KEYS = 4;

/** Maps a keydown to a scouting command, or null when the key is not ours. */
export function resolveKey(e: KeyLike, ctx: HotkeyContext): Command | null {
  if (ctx.typing) return null;
  const { key } = e;
  const shift = !!e.shiftKey;
  const ctrl = !!e.ctrlKey;
  const meta = !!e.metaKey;
  const alt = !!e.altKey;

  if (ctx.helpOpen) {
    if (key === '?') return { type: 'toggleHelp' };
    if (key === 'Escape') return { type: 'closeHelp' };
    return null;
  }
  if (ctx.dialogOpen) return null;

  // Grade characters may need AltGr (Ctrl+Alt on Windows) or Option on some
  // layouts: accept those, but never Cmd or a plain Ctrl combo.
  if ((GRADE_KEYS as readonly string[]).includes(key) && !meta && !(ctrl && !alt)) {
    if (!ctx.inSet || !ctx.panelSkill) return null;
    const grade = key as Grade;
    return validGrades(ctx.panelSkill).includes(grade) ? { type: 'grade', grade } : null;
  }

  if (ctrl || meta) {
    if (!alt && !shift && key.toLowerCase() === 'z') return { type: 'undo' };
    return null;
  }
  if (alt) return null;

  if (key === '?') return { type: 'toggleHelp' };
  if (key === 'Backspace') return ctx.jerseyPending ? { type: 'jerseyBackspace' } : { type: 'undo' };
  if (key === 'Escape') return ctx.panelSkill || ctx.jerseyPending ? { type: 'close' } : null;
  if (shift && key.toLowerCase() === 'a') return { type: 'toggleAuto' };

  if (!ctx.inSet) return null;

  if (key === 'Enter') return ctx.jerseyPending ? { type: 'commitJersey' } : null;

  if (/^[0-9]$/.test(key)) {
    const n = Number(key);
    if (ctx.reasonCount > 0 && n >= 1 && n <= MAX_REASON_KEYS) {
      return n <= ctx.reasonCount ? { type: 'reason', index: n - 1 } : null;
    }
    return { type: 'digit', digit: key };
  }

  if (key.length !== 1) return null;
  const letter = key.toLowerCase();
  if (shift) {
    if (letter === 't') return { type: 'timeout', team: 'them' };
    if (letter === 's') return ctx.canSub ? { type: 'sub' } : null;
    return null;
  }
  if (letter === 'p') return { type: 'point', winner: 'us' };
  if (letter === 'o') return { type: 'point', winner: 'them' };
  if (letter === 't') return { type: 'timeout', team: 'us' };
  const skill = SKILL_KEYS.find((s) => s.toLowerCase() === letter);
  if (skill && ctx.panelSkill && ctx.panelSkills.includes(skill)) return { type: 'skill', skill };
  return null;
}

/** Focus is somewhere keys type text. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || typeof (el as HTMLElement).tagName !== 'string') return false;
  const node = el as HTMLElement;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || node.isContentEditable === true;
}

// ---- Jersey-number buffer ---------------------------------------------------

export const JERSEY_IDLE_MS = 700;

export interface JerseyBuffer {
  digits: string;
  /** When the buffer commits on its own (ms, same clock as `now`). */
  deadline: number | null;
}

export const EMPTY_JERSEY: JerseyBuffer = { digits: '', deadline: null };

export type JerseyAction =
  | { type: 'digit'; digit: string; now: number }
  | { type: 'commit' }
  | { type: 'tick'; now: number }
  | { type: 'backspace'; now: number }
  | { type: 'clear' };

interface JerseyStep {
  buffer: JerseyBuffer;
  /** Jersey number to select now. */
  select: number | null;
  /** Digits that match nobody (show a hint). */
  unknown: string | null;
}

function done(select: number | null, unknown: string | null): JerseyStep {
  return { buffer: EMPTY_JERSEY, select, unknown };
}

function commit(digits: string, numbers: readonly number[]): JerseyStep {
  if (!digits) return done(null, null);
  const hit = numbers.filter((n) => String(n) === digits);
  return hit.length === 1 ? done(hit[0], null) : done(null, digits);
}

/**
 * Buffers typed digits into a jersey number. Selects at once when exactly one
 * player has that number and no longer number starts with it; otherwise waits
 * for Enter or JERSEY_IDLE_MS of silence. Digits no number starts with are
 * reported as unknown immediately.
 */
export function jerseyReducer(buffer: JerseyBuffer, action: JerseyAction, numbers: readonly number[]): JerseyStep {
  switch (action.type) {
    case 'digit': {
      const digits = buffer.digits + action.digit;
      const exact = numbers.filter((n) => String(n) === digits);
      const longer = numbers.some((n) => String(n) !== digits && String(n).startsWith(digits));
      if (exact.length === 1 && !longer) return done(exact[0], null);
      if (exact.length === 0 && !longer) return done(null, digits);
      return { buffer: { digits, deadline: action.now + JERSEY_IDLE_MS }, select: null, unknown: null };
    }
    case 'commit':
      return commit(buffer.digits, numbers);
    case 'tick':
      if (buffer.deadline === null || action.now < buffer.deadline) return { buffer, select: null, unknown: null };
      return commit(buffer.digits, numbers);
    case 'backspace': {
      const digits = buffer.digits.slice(0, -1);
      return { buffer: digits ? { digits, deadline: action.now + JERSEY_IDLE_MS } : EMPTY_JERSEY, select: null, unknown: null };
    }
    case 'clear':
      return done(null, null);
  }
}
