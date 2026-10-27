import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { it as itCatalog } from '../i18n/it';
import { issueMessage } from './text/issueMessage';
import { engineWarningText } from './scoutEngine';
import { lineup51Message } from './rotation';

describe('issueMessage', () => {
  const base = { rally: 0, blocking: true } as const;
  it('words a missing grade in English', () => {
    expect(issueMessage({ ...base, kind: 'missingGrade', number: 7, skill: 'A' }, en)).toBe('Pick a grade for #7 Attack.');
  });
  it('words it in Italian', () => {
    expect(issueMessage({ ...base, kind: 'missingGrade', number: 7, skill: 'A' }, itCatalog)).toBe('Scegli una valutazione per #7 Attacco.');
  });
  it('words the other kinds in both languages', () => {
    expect(issueMessage({ ...base, kind: 'unknownNumber', number: 9 }, en)).toBe("#9 is not in this match's roster.");
    expect(issueMessage({ ...base, kind: 'unknownNumber', number: 9 }, itCatalog)).toBe('Il #9 non è nella rosa di questa partita.');
    expect(issueMessage({ ...base, kind: 'noWinner' }, en)).toBe('No winner for this rally.');
    expect(issueMessage({ ...base, kind: 'noWinner' }, itCatalog)).toBe('Nessun vincitore per questo scambio.');
  });
});

describe('engineWarningText', () => {
  it('words a plain code in both languages', () => {
    expect(engineWarningText({ eventId: 'e', code: 'setEndTie' }, en)).toBe('A set cannot end tied — ignored.');
    expect(engineWarningText({ eventId: 'e', code: 'setEndTie' }, itCatalog)).toBe('Un set non può finire in parità — ignorato.');
  });
  it('words the limit cases with the limit', () => {
    expect(engineWarningText({ eventId: 'e', code: 'subLimit', limit: 6 }, en)).toBe('More than 6 substitutions this set.');
    expect(engineWarningText({ eventId: 'e', code: 'subLimit', limit: 6 }, itCatalog)).toBe('Più di 6 cambi in questo set.');
    expect(engineWarningText({ eventId: 'e', code: 'timeoutLimit', limit: 2 }, en)).toBe('More than 2 timeouts this set.');
    expect(engineWarningText({ eventId: 'e', code: 'timeoutLimit', limit: 2 }, itCatalog)).toBe('Più di 2 time-out in questo set.');
  });
});

describe('lineup51Message', () => {
  it('words a pair warning in both languages', () => {
    expect(lineup51Message({ code: 'middles' }, en)).toBe('Middles are not opposite each other.');
    expect(lineup51Message({ code: 'middles' }, itCatalog)).toBe('I centrali non sono in posizione opposta.');
  });
  it('words an expected-count warning with the right plural', () => {
    expect(lineup51Message({ code: 'expected', role: 'MB', count: 2, found: 1 }, en)).toMatch(/^Expected 2 .* on court, found 1\.$/);
    expect(lineup51Message({ code: 'expected', role: 'S', count: 1, found: 0 }, itCatalog)).toMatch(/^Previsti 1 .* in campo, trovati 0\.$/);
  });
});
