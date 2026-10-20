import { describe, expect, it } from 'vitest';
import { cardFileName } from './exportCards';

describe('exportCards', () => {
  it('file names', () => {
    expect(cardFileName('mvp', { kind: 'match', date: '2026-10-12', opponent: 'VC Rivals / B' })).toBe('award-mvp-2026-10-12-vs-VC-Rivals-B.png');
    expect(cardFileName('c-123', { kind: 'season', season: '2026-27' })).toBe('award-c-123-season-2026-27.png');
  });
});
