import { deleteField } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { optionalForCreate, optionalForUpdate } from './optionalFields';

describe('optionalForCreate', () => {
  it('drops undefined, null and empty-array values of the optional keys', () => {
    expect(
      optionalForCreate({ name: 'A', minPlayers: undefined, targets: [], suggestedPlayers: null }, [
        'minPlayers',
        'targets',
        'suggestedPlayers',
      ]),
    ).toEqual({ name: 'A' });
  });

  it('keeps an empty list that is not an optional key', () => {
    expect(optionalForCreate({ exercises: [], targets: [] }, ['targets'])).toEqual({ exercises: [] });
  });

  it('keeps set values', () => {
    expect(optionalForCreate({ name: 'A', minPlayers: 6, targets: ['service'] }, ['minPlayers', 'targets'])).toEqual({
      name: 'A',
      minPlayers: 6,
      targets: ['service'],
    });
  });
});

describe('optionalForUpdate', () => {
  it('turns a null optional key into deleteField()', () => {
    const out = optionalForUpdate({ minPlayers: null, name: 'B' }, ['minPlayers']);
    expect(out.name).toBe('B');
    expect(out.minPlayers).toEqual(deleteField());
  });

  it('turns an empty optional list into deleteField()', () => {
    expect(optionalForUpdate({ targets: [] }, ['targets']).targets).toEqual(deleteField());
  });

  it('leaves an absent optional key absent', () => {
    expect('minPlayers' in optionalForUpdate({ name: 'B' } as { name: string; minPlayers?: number | null }, ['minPlayers'])).toBe(false);
  });
});
