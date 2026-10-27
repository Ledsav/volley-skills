import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { it as itCatalog } from '../../i18n/it';
import { dvwMessageText } from './dvwMessage';

describe('dvwMessageText', () => {
  it('words a grouped drop in English with the first five lines', () => {
    expect(dvwMessageText({ code: 'droppedForJersey', reason: 'unmapped', jersey: 12, lines: [1, 2, 3, 4, 5, 6, 14] }, en)).toBe(
      '7 actions of #12 dropped: not mapped to a player (lines 1, 2, 3, 4, 5, …).',
    );
    expect(dvwMessageText({ code: 'droppedGrade', skill: 'E', grade: '/', lines: [1] }, en)).toBe(
      '1 Set "/" action dropped: the app has no such grade (line 1).',
    );
  });

  it('localizes line lists and plurals in Italian', () => {
    expect(itCatalog.dvw.lineList([3])).toBe('riga 3');
    expect(itCatalog.dvw.lineList([1, 2, 3, 4, 5, 6])).toBe('righe 1, 2, 3, 4, 5, …');
    expect(dvwMessageText({ code: 'droppedUnknownPlayer', lines: [7, 12] }, itCatalog)).toContain('(righe 7, 12)');
    expect(dvwMessageText({ code: 'droppedGrade', skill: 'E', grade: '/', lines: [1] }, itCatalog)).toContain('Alzata');
  });
});
