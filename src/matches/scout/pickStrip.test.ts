import { describe, expect, it } from 'vitest';
import { pickStrip } from './pickStrip';

const none = { error: false, matchOver: false, betweenSets: false, inserting: false };

describe('pickStrip', () => {
  it('error outranks match over, which outranks between sets, which outranks inserting', () => {
    expect(pickStrip({ error: true, matchOver: true, betweenSets: true, inserting: true })).toBe('error');
    expect(pickStrip({ ...none, matchOver: true, betweenSets: true, inserting: true })).toBe('matchOver');
    expect(pickStrip({ ...none, betweenSets: true, inserting: true })).toBe('betweenSets');
    expect(pickStrip({ ...none, inserting: true })).toBe('inserting');
  });

  it('nothing to show is null', () => {
    expect(pickStrip(none)).toBeNull();
  });
});
