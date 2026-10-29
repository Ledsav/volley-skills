import { describe, expect, it } from 'vitest';
import { searchTokens } from '../../src/search/searchTokens.js';
import { planSearchTokens } from './searchTokensPlan.mjs';

describe('planSearchTokens', () => {
  it('plans docs with missing tokens', () => {
    const plan = planSearchTokens([{ path: 'clubs/c/exercises/e1', kind: 'exercise', data: { name: 'Rete attacco' } }]);
    expect(plan).toEqual([{ path: 'clubs/c/exercises/e1', searchTokens: searchTokens('Rete attacco') }]);
  });

  it('skips docs whose tokens already match', () => {
    const data = { name: 'Rete attacco', searchTokens: searchTokens('Rete attacco') };
    expect(planSearchTokens([{ path: 'p', kind: 'exercise', data }])).toEqual([]);
  });

  it('replans a renamed doc', () => {
    const data = { name: 'Servizio', searchTokens: searchTokens('Rete attacco') };
    expect(planSearchTokens([{ path: 'p', kind: 'exercise', data }])).toEqual([{ path: 'p', searchTokens: searchTokens('Servizio') }]);
  });

  it('uses businessId for trainings', () => {
    const data = { name: 'Sessione', businessId: 'TR-0007' };
    const [u] = planSearchTokens([{ path: 'p', kind: 'training', data }]);
    expect(u.searchTokens).toEqual(searchTokens('Sessione', 'TR-0007'));
    expect(u.searchTokens).toContain('tr-0007');
    const [e] = planSearchTokens([{ path: 'q', kind: 'exercise', data }]);
    expect(e.searchTokens).not.toContain('tr-0007');
  });

  it('skips docs without a name', () => {
    expect(planSearchTokens([
      { path: 'a', kind: 'exercise', data: {} },
      { path: 'b', kind: 'exercise', data: { name: 5 } },
    ])).toEqual([]);
  });
});
