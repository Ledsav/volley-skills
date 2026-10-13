import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '../../types/match';
import { anonymizeNames, batchToPayloads, buildMessages, chunkText, mergeBatches, parseBatch, type ParsedBatch } from './textScout';

const roster: RosterEntry[] = [
  { playerId: 'p7', number: 7, name: 'Ana Pérez', positionCategory: 'OH' },
  { playerId: 'p9', number: 9, name: 'Lucía Gómez', positionCategory: 'OH' },
  { playerId: 'p2', number: 2, name: 'Sara Ruiz', positionCategory: 'S' },
  { playerId: 'p12', number: 12, name: 'Sara López', positionCategory: 'L' },
];

describe('anonymizeNames', () => {
  it('replaces first and full names with jersey numbers, ignoring accents and case', () => {
    expect(anonymizeNames('lucia kill, Ana Pérez ace', roster)).toBe('#9 kill, #7 ace');
    expect(anonymizeNames('LUCÍA bad reception', roster)).toBe('#9 bad reception');
  });

  it('hides an ambiguous first name instead of sending it', () => {
    expect(anonymizeNames('Sara set', roster)).toBe('#? set');
    expect(anonymizeNames('Sara Ruiz set', roster)).toBe('#? #2 set');
  });

  it('leaves volleyball words alone', () => {
    expect(anonymizeNames('7 ace, opp error, TO them', roster)).toBe('7 ace, opp error, TO them');
  });
});

describe('buildMessages', () => {
  it('sends numbers, roles and the anchor, never names', () => {
    const msgs = buildMessages(
      '#9 kill',
      [{ number: 9, role: 'OH', isLibero: false }, { number: 12, role: 'L', isLibero: true }],
      { set: 2, score: { us: 12, them: 10 }, serving: 'us', rotation: 3, onCourt: [9, 2, 7, 4, 11, 5] },
    );
    expect(msgs[0].role).toBe('system');
    const user = msgs[1].content;
    expect(user).toContain('"number":9');
    expect(user).toContain('"isLibero":true');
    expect(user).toContain('12-10');
    expect(user).toContain('#9 kill');
    expect(user).not.toMatch(/Lucía|Ana/);
  });
});

describe('parseBatch', () => {
  it('accepts a valid batch and fills defaults', () => {
    const r = parseBatch({ rallies: [{ actions: [{ number: 7, skill: 'S', grade: '#' }] }], unparsed: [] });
    expect(r).toEqual({
      ok: true,
      batch: { rallies: [{ actions: [{ number: 7, skill: 'S', grade: '#' }], point: null, subs: [], timeouts: [] }], unparsed: [] },
    });
  });

  it('maps unknown point reasons to null and keeps valid ones', () => {
    const r = parseBatch({ rallies: [{ actions: [], point: { winner: 'them', reason: 'whatever' } }, { actions: [], point: { winner: 'us', reason: 'oppError' } }] });
    expect(r.ok && r.batch.rallies.map((x) => x.point)).toEqual([{ winner: 'them', reason: null }, { winner: 'us', reason: 'oppError' }]);
  });

  it('rejects invalid skills, grades, numbers and shapes', () => {
    expect(parseBatch({ rallies: [{ actions: [{ number: 7, skill: 'X', grade: '#' }] }] }).ok).toBe(false);
    expect(parseBatch({ rallies: [{ actions: [{ number: 7, skill: 'A', grade: '++' }] }] }).ok).toBe(false);
    expect(parseBatch({ rallies: [{ actions: [{ number: 'seven', skill: 'A', grade: '#' }] }] }).ok).toBe(false);
    expect(parseBatch({ nope: true }).ok).toBe(false);
    expect(parseBatch(null).ok).toBe(false);
  });
});

describe('batchToPayloads', () => {
  const batch = (rallies: ParsedBatch['rallies']): ParsedBatch => ({ rallies, unparsed: [] });
  const r = (over: Partial<ParsedBatch['rallies'][number]>) => ({ actions: [], point: null, subs: [], timeouts: [], ...over });

  it('maps actions, adds a point only when no action decides the rally', () => {
    const { payloads, issues } = batchToPayloads(
      batch([
        r({ actions: [{ number: 7, skill: 'S', grade: '#' }], point: { winner: 'us', reason: null } }),
        r({ actions: [{ number: 9, skill: 'R', grade: '+' }], point: { winner: 'them', reason: 'oppKill' } }),
      ]),
      roster,
    );
    expect(payloads).toEqual([
      { type: 'action', playerId: 'p7', skill: 'S', grade: '#' },
      { type: 'action', playerId: 'p9', skill: 'R', grade: '+' },
      { type: 'point', winner: 'them', reason: 'oppKill' },
    ]);
    expect(issues).toEqual([]);
  });

  it('puts subs and timeouts before the rally actions', () => {
    const { payloads } = batchToPayloads(
      batch([r({ subs: [{ outNumber: 9, inNumber: 7 }], timeouts: [{ team: 'them' }], point: { winner: 'us', reason: 'oppError' } })]),
      roster,
    );
    expect(payloads.map((p) => p.type)).toEqual(['sub', 'timeout', 'point']);
  });

  it('flags unknown jersey numbers as blocking and skips them', () => {
    const { payloads, issues } = batchToPayloads(batch([r({ actions: [{ number: 33, skill: 'A', grade: '#' }] })]), roster);
    expect(payloads).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({ rally: 0, kind: 'unknownNumber', blocking: true }));
  });

  it('warns about rallies with no winner and about contradicting winners', () => {
    const { issues } = batchToPayloads(
      batch([
        r({ actions: [{ number: 9, skill: 'R', grade: '+' }] }),
        r({ actions: [{ number: 7, skill: 'A', grade: '#' }], point: { winner: 'them', reason: null } }),
      ]),
      roster,
    );
    expect(issues).toEqual([
      expect.objectContaining({ rally: 0, kind: 'noWinner', blocking: false }),
      expect.objectContaining({ rally: 1, kind: 'conflictingWinner', blocking: false }),
    ]);
  });
});

describe('chunkText and mergeBatches', () => {
  it('splits on lines under the size limit and never drops text', () => {
    const text = ['a'.repeat(30), 'b'.repeat(30), 'c'.repeat(30)].join('\n');
    const chunks = chunkText(text, 65);
    expect(chunks).toEqual([`${'a'.repeat(30)}\n${'b'.repeat(30)}`, 'c'.repeat(30)]);
    expect(chunkText('  ')).toEqual([]);
  });

  it('concatenates rallies and unparsed lines', () => {
    const a: ParsedBatch = { rallies: [{ actions: [], point: { winner: 'us', reason: null }, subs: [], timeouts: [] }], unparsed: ['x'] };
    const b: ParsedBatch = { rallies: [], unparsed: ['y'] };
    expect(mergeBatches([a, b])).toEqual({ rallies: a.rallies, unparsed: ['x', 'y'] });
  });
});
