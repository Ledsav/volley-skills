import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '../../types/match';
import { SKILL_LABELS } from '../skillGrades';
import { SYSTEM_PROMPT, anonymizeNames, batchToPayloads, buildMessages, chunkText, mergeBatches, parseBatch, type ParsedBatch } from './textScout';

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

  it('blocks and skips actions whose grade does not exist for the skill', () => {
    const { payloads, issues } = batchToPayloads(batch([r({ actions: [{ number: 7, skill: 'B', grade: '!' }] })]), roster);
    expect(payloads).toEqual([]);
    expect(issues.find((x) => x.kind === 'invalidGrade')).toMatchObject({ rally: 0, blocking: true });
  });

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

describe('name privacy', () => {
  const rosterH: RosterEntry[] = [{ playerId: 'p4', number: 4, name: 'Ana-María López', positionCategory: 'OH' }];
  const rosterO: RosterEntry[] = [{ playerId: 'p3', number: 3, name: "O'Neil", positionCategory: 'OH' }];
  const rosterC: RosterEntry[] = [{ playerId: 'p5', number: 5, name: 'María de la Cruz', positionCategory: 'OH' }];

  it('matches decomposed (NFD) accents', () => {
    expect(anonymizeNames('Luci\u0301a kill', roster)).toBe('#9 kill');
  });

  it('keeps punctuation around names, including possessives and hyphens', () => {
    expect(anonymizeNames("Ana's ace", roster)).toBe("#7's ace");
    expect(anonymizeNames('Ana’s ace', roster)).toBe('#7’s ace');
    expect(anonymizeNames('(Ana)', roster)).toBe('(#7)');
    expect(anonymizeNames('Ana-Lucía', roster)).toBe('#7-#9');
  });

  it('splits roster names with hyphens and apostrophes into parts', () => {
    expect(anonymizeNames('María ace', rosterH)).toBe('#4 ace');
    expect(anonymizeNames('Ana-María', rosterH)).toBe('#4');
    expect(anonymizeNames("O'Neil kill", rosterO)).toBe("O'#3 kill");
    expect(anonymizeNames('O’Neil kill', rosterO)).toBe('O’#3 kill');
  });

  it('collapses repeated numbers joined by a hyphen', () => {
    expect(anonymizeNames('Ana Ana-Ana', roster)).toBe('#7');
  });

  it('does not map name particles or note words', () => {
    expect(anonymizeNames('error de recepción, María ace', rosterC)).toBe('error de recepción, #5 ace');
    expect(anonymizeNames('Cruz set', rosterC)).toBe('#5 set');
  });
});

describe('parseBatch hardening', () => {
  it('keeps a point reason only when it fits the winner', () => {
    const r = parseBatch({
      rallies: [
        { actions: [], point: { winner: 'us', reason: 'oppKill' } },
        { actions: [], point: { winner: 'them', reason: 'oppKill' } },
      ],
    });
    expect(r.ok && r.batch.rallies.map((x) => x.point)).toEqual([
      { winner: 'us', reason: null },
      { winner: 'them', reason: 'oppKill' },
    ]);
  });

  it('rejects non-array actions, subs or timeouts and non-object points', () => {
    expect(parseBatch({ rallies: [{ actions: {} }] }).ok).toBe(false);
    expect(parseBatch({ rallies: [{ subs: 'x' }] }).ok).toBe(false);
    expect(parseBatch({ rallies: [{ timeouts: 5 }] }).ok).toBe(false);
    expect(parseBatch({ rallies: [{ point: 'us' }] }).ok).toBe(false);
  });

  it('accepts a null point and absent arrays', () => {
    expect(parseBatch({ rallies: [{ point: null }] }).ok).toBe(true);
    expect(parseBatch({ rallies: [{}] }).ok).toBe(true);
  });
});

describe('parseBatch null as absent', () => {
  it('treats null actions, subs, timeouts and point as absent', () => {
    const r = parseBatch({ rallies: [{ actions: [{ number: 7, skill: 'S', grade: '#' }], subs: null, timeouts: null, point: null }] });
    expect(r).toEqual({
      ok: true,
      batch: { rallies: [{ actions: [{ number: 7, skill: 'S', grade: '#' }], point: null, subs: [], timeouts: [] }], unparsed: [] },
    });
  });
});

describe('stoplisted first names', () => {
  const rosterLe: RosterEntry[] = [{ playerId: 'p5', number: 5, name: 'Le Nguyen', positionCategory: 'OH' }];

  it('always strips the given name, even when it is a particle', () => {
    expect(anonymizeNames('Le kill', rosterLe)).toBe('#5 kill');
    expect(anonymizeNames('Nguyen ace', rosterLe)).toBe('#5 ace');
  });

  it('still leaves particles inside a surname alone in notes', () => {
    expect(anonymizeNames('de la error', rosterC())).toBe('de la error');
  });
});

function rosterC(): RosterEntry[] {
  return [{ playerId: 'p5', number: 5, name: 'María de la Cruz', positionCategory: 'OH' }];
}

describe('parseBatch coercion and size caps', () => {
  it('accepts digit-string numbers and lowercase skills', () => {
    const r = parseBatch({
      rallies: [{ actions: [{ number: '7', skill: 'a', grade: '#' }], subs: [{ outNumber: '9', inNumber: '8' }] }],
    });
    expect(r.ok && r.batch.rallies[0]).toEqual({
      actions: [{ number: 7, skill: 'A', grade: '#' }],
      point: null,
      subs: [{ outNumber: 9, inNumber: 8 }],
      timeouts: [],
    });
  });

  it('still rejects non-digit number strings', () => {
    expect(parseBatch({ rallies: [{ actions: [{ number: '7a', skill: 'A', grade: '#' }] }] }).ok).toBe(false);
    expect(parseBatch({ rallies: [{ subs: [{ outNumber: '-1', inNumber: '8' }] }] }).ok).toBe(false);
  });

  it('rejects replies with too many rallies or actions', () => {
    const action = { number: 7, skill: 'S', grade: '#' };
    expect(parseBatch({ rallies: Array.from({ length: 200 }, () => ({})) }).ok).toBe(true);
    expect(parseBatch({ rallies: Array.from({ length: 201 }, () => ({})) })).toEqual({ ok: false, error: 'Reply too large.' });
    expect(parseBatch({ rallies: [{ actions: Array.from({ length: 30 }, () => action) }] }).ok).toBe(true);
    expect(parseBatch({ rallies: [{ actions: Array.from({ length: 31 }, () => action) }] })).toEqual({ ok: false, error: 'Reply too large.' });
  });
});

describe('SYSTEM_PROMPT', () => {
  it('assigns between-rally subs and timeouts to the next rally', () => {
    expect(SYSTEM_PROMPT).toContain("belong to the NEXT rally's entry");
  });
});

describe('ungraded actions', () => {
  it('parseBatch accepts a null or missing grade but still rejects invalid ones', () => {
    const r = parseBatch({ rallies: [{ actions: [{ number: 7, skill: 'A', grade: null }, { number: 9, skill: 'S' }] }] });
    expect(r.ok && r.batch.rallies[0].actions).toEqual([
      { number: 7, skill: 'A', grade: null },
      { number: 9, skill: 'S', grade: null },
    ]);
    expect(parseBatch({ rallies: [{ actions: [{ number: 7, skill: 'A', grade: '++' }] }] }).ok).toBe(false);
  });

  it('SYSTEM_PROMPT allows a null grade and knows everyday words', () => {
    expect(SYSTEM_PROMPT).toContain('"grade": null');
    expect(SYSTEM_PROMPT).toContain('Never put a line in unparsed just because the result is missing.');
    for (const w of ['smash', 'remate', 'attaque', 'bola fácil', 'contré']) expect(SYSTEM_PROMPT).toContain(w);
  });

  it('SYSTEM_PROMPT teaches the app per-skill grade labels and new synonyms', () => {
    expect(SYSTEM_PROMPT).toContain('S (Serve): "#" Ace, "+" Pressure, "!" OK, "-" Easy, "/" Free back, "=" Error');
    for (const s of ['S', 'R', 'A', 'B', 'D', 'E', 'F'] as const) expect(SYSTEM_PROMPT).toContain(`\n${s} (${SKILL_LABELS[s]}): "`);
    expect(SYSTEM_PROMPT).toContain('use that grade');
    for (const w of ['too easy', 'difícil', 'couvert']) expect(SYSTEM_PROMPT).toContain(w);
  });

  it('batchToPayloads blocks an ungraded action, skips it and still warns about the winner', () => {
    const b: ParsedBatch = { rallies: [{ actions: [{ number: 7, skill: 'A', grade: null }], point: null, subs: [], timeouts: [] }], unparsed: [] };
    const { payloads, issues } = batchToPayloads(b, roster);
    expect(payloads).toEqual([]);
    expect(issues).toContainEqual({ rally: 0, kind: 'missingGrade', blocking: true, number: 7, skill: 'A' });
    expect(issues).toContainEqual(expect.objectContaining({ rally: 0, kind: 'noWinner', blocking: false }));
  });

  it('does not let an earlier decision hide an ungraded last action', () => {
    const b: ParsedBatch = {
      rallies: [{ actions: [{ number: 7, skill: 'S', grade: '=' }, { number: 9, skill: 'A', grade: null }], point: null, subs: [], timeouts: [] }],
      unparsed: [],
    };
    const { issues } = batchToPayloads(b, roster);
    expect(issues).toContainEqual(expect.objectContaining({ rally: 0, kind: 'noWinner' }));
  });
});
