import { describe, expect, it, vi } from 'vitest';
import { buildPlayerExport, downloadPlayerExport } from './playerExport';
import type { Player } from '../types/player';

const player = {
  id: 'player-1',
  number: 7,
  fullName: 'Alberto Valdes Rey',
  dob: '2011-05-01',
  nationality: 'ESP',
  licenseNumber: 'J-000123',
  positionCategory: 'L',
  starting: true,
  playerPhone: '',
  guardians: [{ relation: 'mother', name: 'A', phone: '', email: 'mum@example.com' }],
  viewerEmails: ['mum@example.com'],
  teamName: 'U17',
  ageGroup: 'U17',
  season: '2026-27',
  skills: {
    serve: { score: 8, notes: 'strong jump serve', priority: false },
    attack: { score: 6, notes: '', priority: true },
    set: { score: null, notes: '', priority: false },
    defence: { score: null, notes: '', priority: false },
    reception: { score: null, notes: '', priority: false },
    jump: { score: null, notes: '', priority: false },
    speed: { score: null, notes: '', priority: false },
    iq: { score: null, notes: '', priority: false },
  },
  avgScore: 7,
  level: 'Advanced',
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: 'keep it up' },
  consent: { given: true, date: '2026-09-07', confirmedBy: 'coach@example.com' },
  createdBy: 'coach-uid',
  createdAt: { toDate: () => new Date('2026-01-02T03:04:05.000Z') },
  updatedAt: null,
} as unknown as Player;

describe('buildPlayerExport', () => {
  it('includes the full player record and physical-test history', () => {
    const result = buildPlayerExport(player, [{ id: 'test-1', testType: 'cmj', bestCm: 34, date: '2026-09-07' } as never], new Date('2026-09-07T10:00:00.000Z'));

    expect(result.exportedAt).toBe('2026-09-07T10:00:00.000Z');
    expect(result.player).toMatchObject({
      fullName: 'Alberto Valdes Rey',
      licenseNumber: 'J-000123',
      guardians: [{ relation: 'mother', name: 'A', phone: '', email: 'mum@example.com' }],
      skills: expect.objectContaining({ serve: { score: 8, notes: 'strong jump serve', priority: false } }),
      developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: 'keep it up' },
      consent: { given: true, date: '2026-09-07', confirmedBy: 'coach@example.com' },
    });
    expect(result.physicalTests).toEqual([{ id: 'test-1', testType: 'cmj', bestCm: 34, date: '2026-09-07' }]);
  });

  it('normalizes Firestore Timestamp fields to ISO strings and leaves nulls alone', () => {
    const result = buildPlayerExport(player, [], new Date('2026-09-07T10:00:00.000Z'));
    expect(result.player.createdAt).toBe('2026-01-02T03:04:05.000Z');
    expect(result.player.updatedAt).toBeNull();
  });

  it('produces a JSON-serializable object', () => {
    const result = buildPlayerExport(player, [], new Date('2026-09-07T10:00:00.000Z'));
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});

describe('downloadPlayerExport', () => {
  it('creates a blob URL and clicks an anchor', () => {
    let capturedBlob: unknown;
    const createObjectURL = vi.fn((blob: unknown) => {
      capturedBlob = blob;
      return 'blob:fake';
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadPlayerExport(player, []);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(capturedBlob).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});
