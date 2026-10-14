import { describe, expect, it } from 'vitest';
import { matchMvpLabel } from './matchMvp';
import { finished, player } from './testMatches';

describe('matchMvpLabel', () => {
  const m = finished('m1', '2026-10-12', [player('a', { A: '###' }), player('b', { A: '#' })]);

  it('computed from the summary', () => {
    expect(matchMvpLabel(m)).toBe('#1 Player a.');
  });

  it('saved override wins; hidden → null', () => {
    const withPick = { ...m, awards: { picks: { mvp: { playerId: 'b', hidden: false } }, custom: [], order: [], updatedBy: '', updatedAt: null } };
    expect(matchMvpLabel(withPick)).toBe('#2 Player b.');
    const hidden = { ...m, awards: { picks: { mvp: { playerId: null, hidden: true } }, custom: [], order: [], updatedBy: '', updatedAt: null } };
    expect(matchMvpLabel(hidden)).toBeNull();
  });

  it('null when nothing is scouted', () => {
    expect(matchMvpLabel(finished('x', '2026-10-01', null))).toBeNull();
  });
});
