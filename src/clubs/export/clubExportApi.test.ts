import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDoc, getDocFromServer } from 'firebase/firestore';
import { readAll, readAllFromServer } from '../../firebase/readAll';
import { loadTeamExportData } from '../../teams/teamExportApi';
import { loadClubExportData } from './clubExportApi';

vi.mock('firebase/firestore', () => ({ getDoc: vi.fn(), getDocFromServer: vi.fn() }));
vi.mock('../../firebase/clubPaths', () => ({
  clubCol: (...s: string[]) => s.join('/'),
  clubDoc: (...s: string[]) => s.join('/') || 'club',
}));
vi.mock('../../firebase/readAll', () => ({ readAll: vi.fn(), readAllFromServer: vi.fn() }));
vi.mock('../../teams/teamExportApi', () => ({ loadTeamExportData: vi.fn() }));

const snap = (id: string, data: Record<string, unknown> | null) => ({ id, exists: () => data !== null, data: () => data });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDocFromServer).mockImplementation(async (ref) =>
    snap(String(ref), ref === ('club' as never) ? { name: 'VC' } : null) as never,
  );
  vi.mocked(readAllFromServer).mockResolvedValue([]);
});

describe('loadClubExportData', () => {
  it('reads only from the server, never the offline cache', async () => {
    const progress: string[] = [];
    const data = await loadClubExportData((l) => progress.push(l));
    expect(data.club).toEqual({ id: 'club', name: 'VC' });
    expect(data.skillGuide).toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
    expect(readAll).not.toHaveBeenCalled();
    expect(vi.mocked(readAllFromServer).mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['members', 'acceptances', 'statusLog', 'teams', 'exercises', 'trainings', 'counters', 'sectionAccess']),
    );
    expect(progress).toEqual(['Club and people', 'Library', 'Guides and access']);
  });

  it('loads each team with events and calendar, plus its awards', async () => {
    vi.mocked(readAllFromServer).mockImplementation(async (col) =>
      (col === ('teams' as never) ? [{ id: 't1', data: () => ({ name: 'U17' }) }] : []) as never,
    );
    vi.mocked(loadTeamExportData).mockResolvedValue({ team: { id: 't1' } } as never);
    const progress: string[] = [];
    const data = await loadClubExportData((l) => progress.push(l));
    expect(loadTeamExportData).toHaveBeenCalledWith('t1', { includeEvents: true, includeCalendar: true });
    expect(readAllFromServer).toHaveBeenCalledWith('teams/t1/awards');
    expect(data.teams).toHaveLength(1);
    expect(progress).toContain('Team 1 of 1: U17');
  });

  it('fails instead of exporting a partial club when offline', async () => {
    vi.mocked(readAllFromServer).mockRejectedValue(new Error('Failed to get documents from server.'));
    await expect(loadClubExportData(() => {})).rejects.toThrow(/from server/);
  });
});
