import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../../types/match';
import { onlyImports, undoTarget } from './undoTarget';

const tap = (id: string, order: number): MatchEvent => ({ id, order, source: 'tap', chunkId: null, type: 'timeout', team: 'us' });
const imp = (id: string, order: number): MatchEvent => ({ id, order, source: 'import', chunkId: 'imp', type: 'timeout', team: 'them' });

describe('undoTarget', () => {
  it("pops this device's stack first, skipping ids no longer in the snapshot", () => {
    const events = [tap('e1', 1), tap('e2', 2), tap('e3', 3)];
    expect(undoTarget(events, ['e2', 'gone'])).toEqual({ kind: 'single', ids: ['e2'], stack: [] });
  });

  it('falls back to the last event by order', () => {
    const events = [tap('e3', 3), tap('e1', 1), tap('e2', 2)];
    expect(undoTarget(events, [])).toMatchObject({ kind: 'single', ids: ['e3'] });
  });

  it('skips imported events in the stack and in the fallback', () => {
    const events = [imp('i1', 1), imp('i2', 2), imp('i3', 3), tap('t4', 4)];
    expect(undoTarget(events, ['i3'])).toEqual({ kind: 'single', ids: ['t4'], stack: [] });
  });

  it('a text batch returns every event of its chunk', () => {
    const text = (id: string, order: number): MatchEvent => ({ id, order, source: 'text', chunkId: 'c', type: 'timeout', team: 'us' });
    const t = undoTarget([tap('e1', 1), text('a', 2), text('b', 3)], []);
    expect(t.kind).toBe('batch');
    expect([...t.ids].sort()).toEqual(['a', 'b']);
  });

  it('only imports left is importOnly; no events is none', () => {
    expect(undoTarget([imp('i1', 1), imp('i2', 2)], ['i2']).kind).toBe('importOnly');
    expect(undoTarget([], []).kind).toBe('none');
    expect(onlyImports([])).toBe(false);
    expect(onlyImports([imp('i1', 1)])).toBe(true);
    expect(onlyImports([imp('i1', 1), tap('t', 2)])).toBe(false);
  });
});
