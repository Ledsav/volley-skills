import { describe, expect, it } from 'vitest';
import { buildEntryId } from './testingSession';

describe('buildEntryId', () => {
  it('joins playerId and testType with a double underscore', () => {
    expect(buildEntryId('player-1', 'cmj')).toBe('player-1__cmj');
  });

  it('produces distinct ids for every known test type on the same player', () => {
    const types = ['growth', 'cmj', 'approachJump', 'broadJump', 'sprint10m', 'shuttle5105', 'reaction', 'strength'] as const;
    const ids = types.map((t) => buildEntryId('player-1', t));
    expect(new Set(ids).size).toBe(types.length);
  });
});
