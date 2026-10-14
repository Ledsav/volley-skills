import { describe, expect, it } from 'vitest';
import { finished, player } from '../../awards/testMatches';
import type { Player } from '../../types/player';
import { latestRosterIndex, withCurrentRoster } from './rosterIndex';

describe('rosterIndex', () => {
  it('takes name/number from the newest roster snapshot containing the player', () => {
    const old = finished('m1', '2026-09-01', [player('a', {})], { roster: [{ playerId: 'a', number: 4, name: 'Old Name', positionCategory: 'OH' }] });
    const neu = finished('m2', '2026-10-01', [player('a', {})], { roster: [{ playerId: 'a', number: 9, name: 'New Name', positionCategory: 'OH' }] });
    const idx = latestRosterIndex([neu, old]);
    expect(idx.get('a')).toEqual({ playerId: 'a', name: 'New Name', number: 9, current: false });
  });

  it('marks current players and adds those who never played', () => {
    const m = finished('m1', '2026-09-01', [player('a', {})], { roster: [{ playerId: 'a', number: 4, name: 'Ana', positionCategory: 'OH' }] });
    const idx = withCurrentRoster(latestRosterIndex([m]), [
      { id: 'a', number: 5, fullName: 'Ana Current' } as Player,
      { id: 'z', number: 12, fullName: 'Zoë New' } as Player,
    ]);
    expect(idx.get('a')).toMatchObject({ current: true, name: 'Ana', number: 4 }); // snapshot wins for name
    expect(idx.get('z')).toEqual({ playerId: 'z', name: 'Zoë New', number: 12, current: true });
  });
});
