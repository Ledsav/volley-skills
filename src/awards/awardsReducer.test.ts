import { describe, expect, it } from 'vitest';
import { EMPTY_AWARDS } from '../types/awards';
import { applyPrepareAction } from './awardsReducer';

const ordered = ['attacker', 'server', 'mvp'];
const id = () => 'c-1';

describe('applyPrepareAction', () => {
  it('pick sets and clears an override, keeping hidden', () => {
    const a = applyPrepareAction(EMPTY_AWARDS, { type: 'pick', key: 'mvp', playerId: 'p' }, ordered, id);
    expect(a.picks.mvp).toEqual({ playerId: 'p', hidden: false });
    const b = applyPrepareAction({ ...a, picks: { mvp: { playerId: 'p', hidden: true } } }, { type: 'pick', key: 'mvp', playerId: null }, ordered, id);
    expect(b.picks.mvp).toEqual({ playerId: null, hidden: true });
  });

  it('removes a pick entry when it returns to defaults', () => {
    const a = applyPrepareAction({ ...EMPTY_AWARDS, picks: { mvp: { playerId: 'p', hidden: false } } }, { type: 'pick', key: 'mvp', playerId: null }, ordered, id);
    expect(a.picks).toEqual({});
  });

  it('hide', () => {
    expect(applyPrepareAction(EMPTY_AWARDS, { type: 'hide', key: 'server', hidden: true }, ordered, id).picks.server).toEqual({ playerId: null, hidden: true });
  });

  it('move writes the full order', () => {
    expect(applyPrepareAction(EMPTY_AWARDS, { type: 'move', key: 'server', dir: -1 }, ordered, id).order).toEqual(['server', 'attacker', 'mvp']);
    expect(applyPrepareAction(EMPTY_AWARDS, { type: 'move', key: 'mvp', dir: 1 }, ordered, id).order).toEqual(ordered);
  });

  it('add / remove custom', () => {
    const a = applyPrepareAction(EMPTY_AWARDS, { type: 'addCustom', title: 'Spirit', playerId: 'p', note: '' }, ordered, id);
    expect(a.custom).toEqual([{ id: 'c-1', title: 'Spirit', playerId: 'p', note: '' }]);
    expect(a.order).toEqual(['attacker', 'server', 'c-1', 'mvp']);
    const b = applyPrepareAction(a, { type: 'removeCustom', key: 'c-1' }, a.order, id);
    expect(b.custom).toEqual([]);
    expect(b.order).toEqual(ordered);
  });

  it('refuses a 6th custom award', () => {
    const custom = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, title: 'x', playerId: 'p', note: '' }));
    const out = applyPrepareAction({ ...EMPTY_AWARDS, custom }, { type: 'addCustom', title: 'y', playerId: 'p', note: '' }, ordered, id);
    expect(out.custom).toHaveLength(5);
  });
});
