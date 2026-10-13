import { describe, expect, it } from 'vitest';
import { buildTeamExport, type TeamExportData } from './teamExport';

const ts = { toDate: () => new Date('2026-09-01T08:00:00.000Z') };

const data: TeamExportData = {
  team: { id: 't1', name: 'U17', createdAt: ts },
  players: [{ player: { id: 'p1', fullName: 'Ana Lima' }, physicalTests: [{ id: 'pt1', createdAt: ts }] }],
  testingSessions: [{ session: { id: 's1', date: '2026-09-20' }, entries: [{ id: 'p1__cmj' }] }],
  matches: [{ match: { id: 'm1', opponent: 'Rivals' }, events: null }],
  calendar: null,
  scoutProfile: [{ id: 'usage', players: {} }],
};

describe('buildTeamExport', () => {
  it('converts every section to plain JSON', () => {
    const out = buildTeamExport(data, new Date('2026-10-14T10:00:00.000Z'));
    expect(out.exportedAt).toBe('2026-10-14T10:00:00.000Z');
    expect(out.team).toEqual({ id: 't1', name: 'U17', createdAt: '2026-09-01T08:00:00.000Z' });
    expect(out.players).toEqual([
      { player: { id: 'p1', fullName: 'Ana Lima' }, physicalTests: [{ id: 'pt1', createdAt: '2026-09-01T08:00:00.000Z' }] },
    ]);
    expect(out.testingSessions).toEqual(data.testingSessions);
    expect(out.matches).toEqual([{ match: { id: 'm1', opponent: 'Rivals' } }]);
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it('notes what was left out', () => {
    expect(buildTeamExport(data).notes).toHaveLength(2);
    const full = buildTeamExport({ ...data, calendar: [], matches: [{ match: { id: 'm1' }, events: [{ id: 'e1' }] }] });
    expect(full.notes).toEqual([]);
    expect(full.matches).toEqual([{ match: { id: 'm1' }, events: [{ id: 'e1' }] }]);
  });
});
