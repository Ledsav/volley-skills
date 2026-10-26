import { describe, expect, it } from 'vitest';
import {
  EMPTY_JERSEY,
  GRADE_KEYS,
  JERSEY_IDLE_MS,
  KEY_MAP,
  SKILL_KEYS,
  isTypingTarget,
  jerseyReducer,
  keyLabel,
  resolveKey,
  type HotkeyContext,
  type JerseyBuffer,
} from './hotkeys';

const base: HotkeyContext = {
  inSet: true,
  typing: false,
  dialogOpen: false,
  helpOpen: false,
  panelSkill: null,
  panelSkills: [],
  canSub: false,
  reasonCount: 0,
  jerseyPending: false,
};
const withPanel = (over: Partial<HotkeyContext> = {}): HotkeyContext => ({
  ...base,
  panelSkill: 'R',
  panelSkills: ['R', 'S', 'A', 'B', 'D', 'E', 'F'],
  canSub: true,
  ...over,
});

describe('KEY_MAP', () => {
  it('lists every binding once, with grade and fundamental keys from the shared lists', () => {
    const ids = KEY_MAP.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(KEY_MAP.find((b) => b.id === 'grade')?.keys).toEqual(GRADE_KEYS);
    expect(KEY_MAP.find((b) => b.id === 'skill')?.keys).toEqual(SKILL_KEYS);
    expect(keyLabel('pointUs')).toBe('P');
    expect(keyLabel('timeoutThem')).toBe('Shift+T');
    expect(keyLabel('undo')).toBe('Ctrl+Z');
  });
});

describe('resolveKey', () => {
  it('maps grade characters to the open panel skill', () => {
    for (const g of ['#', '+', '!', '-', '/', '=']) {
      expect(resolveKey({ key: g }, withPanel())).toEqual({ type: 'grade', grade: g });
    }
  });

  it('matches the produced character whatever the layout needs to produce it', () => {
    // QWERTY: '#', '+', '!' come with Shift.
    expect(resolveKey({ key: '#', shiftKey: true }, withPanel())).toEqual({ type: 'grade', grade: '#' });
    expect(resolveKey({ key: '+', shiftKey: true }, withPanel())).toEqual({ type: 'grade', grade: '+' });
    // AZERTY: '!' is unshifted, '#' needs AltGr (Ctrl+Alt on Windows).
    expect(resolveKey({ key: '!', shiftKey: false }, withPanel())).toEqual({ type: 'grade', grade: '!' });
    expect(resolveKey({ key: '#', ctrlKey: true, altKey: true }, withPanel())).toEqual({ type: 'grade', grade: '#' });
    // Never a Cmd or plain Ctrl combo.
    expect(resolveKey({ key: '-', ctrlKey: true }, withPanel())).toBeNull();
    expect(resolveKey({ key: '=', metaKey: true }, withPanel())).toBeNull();
  });

  it('ignores grades the skill does not have, and grades with no panel open', () => {
    expect(resolveKey({ key: '!' }, withPanel({ panelSkill: 'B' }))).toBeNull();
    expect(resolveKey({ key: '/' }, withPanel({ panelSkill: 'E' }))).toBeNull();
    expect(resolveKey({ key: '#' }, base)).toBeNull();
  });

  it('switches fundamentals case-insensitively, only those offered for the player', () => {
    expect(resolveKey({ key: 'a' }, withPanel())).toEqual({ type: 'skill', skill: 'A' });
    expect(resolveKey({ key: 'E' }, withPanel())).toEqual({ type: 'skill', skill: 'E' });
    const libero = withPanel({ panelSkills: ['R', 'D', 'F', 'E'], canSub: false });
    expect(resolveKey({ key: 's' }, libero)).toBeNull();
    expect(resolveKey({ key: 'a' }, libero)).toBeNull();
    expect(resolveKey({ key: 'b' }, libero)).toBeNull();
    expect(resolveKey({ key: 'd' }, libero)).toEqual({ type: 'skill', skill: 'D' });
    expect(resolveKey({ key: 'r' }, base)).toBeNull();
  });

  it('buffers digits as jersey input, and Enter commits only a pending number', () => {
    expect(resolveKey({ key: '1' }, base)).toEqual({ type: 'digit', digit: '1' });
    // AZERTY digits come with Shift.
    expect(resolveKey({ key: '6', shiftKey: true }, base)).toEqual({ type: 'digit', digit: '6' });
    expect(resolveKey({ key: 'Enter' }, base)).toBeNull();
    expect(resolveKey({ key: 'Enter' }, { ...base, jerseyPending: true })).toEqual({ type: 'commitJersey' });
  });

  it('records points with P / O, and digits 1–4 pick a showing reason first', () => {
    expect(resolveKey({ key: 'p' }, base)).toEqual({ type: 'point', winner: 'us' });
    expect(resolveKey({ key: 'O' }, base)).toEqual({ type: 'point', winner: 'them' });
    const chips = { ...base, reasonCount: 2 };
    expect(resolveKey({ key: '1' }, chips)).toEqual({ type: 'reason', index: 0 });
    expect(resolveKey({ key: '2' }, chips)).toEqual({ type: 'reason', index: 1 });
    expect(resolveKey({ key: '3' }, chips)).toBeNull();
    expect(resolveKey({ key: '7' }, chips)).toEqual({ type: 'digit', digit: '7' });
    expect(resolveKey({ key: '4' }, { ...base, reasonCount: 4 })).toEqual({ type: 'reason', index: 3 });
  });

  it('T / Shift+T call timeouts', () => {
    expect(resolveKey({ key: 't' }, base)).toEqual({ type: 'timeout', team: 'us' });
    expect(resolveKey({ key: 'T', shiftKey: true }, base)).toEqual({ type: 'timeout', team: 'them' });
  });

  it('undoes with Ctrl+Z, Cmd+Z or Backspace, even between sets', () => {
    const idle = { ...base, inSet: false };
    expect(resolveKey({ key: 'z', ctrlKey: true }, idle)).toEqual({ type: 'undo' });
    expect(resolveKey({ key: 'Z', metaKey: true }, idle)).toEqual({ type: 'undo' });
    expect(resolveKey({ key: 'Backspace' }, idle)).toEqual({ type: 'undo' });
    // Redo and other browser shortcuts are left alone.
    expect(resolveKey({ key: 'z', ctrlKey: true, shiftKey: true }, base)).toBeNull();
    expect(resolveKey({ key: 'r', ctrlKey: true }, base)).toBeNull();
    expect(resolveKey({ key: 'c', metaKey: true }, withPanel())).toBeNull();
  });

  it('Backspace edits a half-typed jersey number instead of undoing', () => {
    expect(resolveKey({ key: 'Backspace' }, { ...base, jerseyPending: true })).toEqual({ type: 'jerseyBackspace' });
  });

  it('Esc closes the panel or a pending number, and is left alone otherwise', () => {
    expect(resolveKey({ key: 'Escape' }, withPanel())).toEqual({ type: 'close' });
    expect(resolveKey({ key: 'Escape' }, { ...base, jerseyPending: true })).toEqual({ type: 'close' });
    expect(resolveKey({ key: 'Escape' }, base)).toBeNull();
  });

  it('Shift+S substitutes the selected non-libero player', () => {
    expect(resolveKey({ key: 'S', shiftKey: true }, withPanel())).toEqual({ type: 'sub' });
    expect(resolveKey({ key: 'S', shiftKey: true }, withPanel({ canSub: false }))).toBeNull();
    expect(resolveKey({ key: 'S', shiftKey: true }, base)).toBeNull();
  });

  it('Shift+A toggles auto-select, and ? the cheat sheet', () => {
    expect(resolveKey({ key: 'A', shiftKey: true }, base)).toEqual({ type: 'toggleAuto' });
    expect(resolveKey({ key: '?', shiftKey: true }, base)).toEqual({ type: 'toggleHelp' });
    expect(resolveKey({ key: '?' }, { ...base, inSet: false })).toEqual({ type: 'toggleHelp' });
  });

  it('with the cheat sheet open, only ? and Esc do anything', () => {
    const help = withPanel({ helpOpen: true, dialogOpen: true });
    expect(resolveKey({ key: '?' }, help)).toEqual({ type: 'toggleHelp' });
    expect(resolveKey({ key: 'Escape' }, help)).toEqual({ type: 'closeHelp' });
    expect(resolveKey({ key: 'p' }, help)).toBeNull();
    expect(resolveKey({ key: '#' }, help)).toBeNull();
  });

  it('ignores everything while typing or while a dialog is open', () => {
    for (const ctx of [withPanel({ typing: true }), withPanel({ dialogOpen: true })]) {
      for (const key of ['#', 'p', 't', '1', '?', 'Escape', 'Backspace']) expect(resolveKey({ key }, ctx)).toBeNull();
      expect(resolveKey({ key: 'z', ctrlKey: true }, ctx)).toBeNull();
    }
  });

  it('records nothing while no set is in play', () => {
    const idle = withPanel({ inSet: false });
    for (const key of ['#', 'p', 'o', 't', '1', 'r', 'Enter']) expect(resolveKey({ key }, idle)).toBeNull();
    expect(resolveKey({ key: 'T', shiftKey: true }, idle)).toBeNull();
    expect(resolveKey({ key: 'S', shiftKey: true }, idle)).toBeNull();
  });

  it('ignores unmapped keys', () => {
    for (const key of ['x', 'Tab', ' ', 'ArrowLeft', 'F5']) expect(resolveKey({ key }, withPanel())).toBeNull();
  });
});

describe('isTypingTarget', () => {
  it('detects text entry elements', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('jerseyReducer', () => {
  const numbers = [1, 2, 7, 16, 4];
  const type = (digits: string, now = 0, start: JerseyBuffer = EMPTY_JERSEY) => {
    let buffer = start;
    let last = { buffer, select: null as number | null, unknown: null as string | null };
    for (const d of digits) {
      last = jerseyReducer(buffer, { type: 'digit', digit: d, now }, numbers);
      buffer = last.buffer;
    }
    return last;
  };

  it('selects at once when the number is unique and no longer number starts with it', () => {
    expect(type('7')).toEqual({ buffer: EMPTY_JERSEY, select: 7, unknown: null });
    expect(type('16')).toEqual({ buffer: EMPTY_JERSEY, select: 16, unknown: null });
  });

  it("waits on an ambiguous prefix ('1' vs '16')", () => {
    expect(type('1', 100)).toEqual({ buffer: { digits: '1', deadline: 100 + JERSEY_IDLE_MS }, select: null, unknown: null });
  });

  it('commits a pending number on Enter', () => {
    const { buffer } = type('1');
    expect(jerseyReducer(buffer, { type: 'commit' }, numbers)).toEqual({ buffer: EMPTY_JERSEY, select: 1, unknown: null });
    expect(jerseyReducer(EMPTY_JERSEY, { type: 'commit' }, numbers)).toEqual({ buffer: EMPTY_JERSEY, select: null, unknown: null });
  });

  it('commits after the idle time, using the injected clock', () => {
    const { buffer } = type('1', 1_000);
    expect(jerseyReducer(buffer, { type: 'tick', now: 1_000 + JERSEY_IDLE_MS - 1 }, numbers).select).toBeNull();
    expect(jerseyReducer(buffer, { type: 'tick', now: 1_000 + JERSEY_IDLE_MS }, numbers)).toEqual({ buffer: EMPTY_JERSEY, select: 1, unknown: null });
  });

  it('reports a number nobody wears, immediately or on commit', () => {
    expect(type('9')).toEqual({ buffer: EMPTY_JERSEY, select: null, unknown: '9' });
    expect(type('13')).toEqual({ buffer: EMPTY_JERSEY, select: null, unknown: '13' });
    const ambiguous = [1, 16];
    const pending = jerseyReducer(EMPTY_JERSEY, { type: 'digit', digit: '1', now: 0 }, [16]);
    expect(pending.buffer.digits).toBe('1');
    expect(jerseyReducer(pending.buffer, { type: 'commit' }, [16])).toEqual({ buffer: EMPTY_JERSEY, select: null, unknown: '1' });
    expect(jerseyReducer(pending.buffer, { type: 'commit' }, ambiguous).select).toBe(1);
  });

  it('backspace drops the last digit and clear empties the buffer', () => {
    const { buffer } = type('1');
    expect(jerseyReducer(buffer, { type: 'backspace', now: 5 }, numbers).buffer).toEqual(EMPTY_JERSEY);
    expect(jerseyReducer({ digits: '12', deadline: 0 }, { type: 'backspace', now: 5 }, numbers).buffer).toEqual({ digits: '1', deadline: 5 + JERSEY_IDLE_MS });
    expect(jerseyReducer(buffer, { type: 'clear' }, numbers)).toEqual({ buffer: EMPTY_JERSEY, select: null, unknown: null });
  });
});
