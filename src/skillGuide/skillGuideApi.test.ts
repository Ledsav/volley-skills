import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DEFAULT_SKILL_GUIDE, getSkillGuide } from './skillGuideApi';

const mockGetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: vi.fn(),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('getSkillGuide', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
  });

  it('falls back to the default 8-skill guide when no config doc exists yet', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const guide = await getSkillGuide();

    expect(guide.skills).toEqual(DEFAULT_SKILL_GUIDE);
    expect(guide.skills).toHaveLength(8);
    expect(guide.skills.map((s) => s.key)).toEqual([
      'serve',
      'attack',
      'set',
      'defence',
      'reception',
      'jump',
      'speed',
      'iq',
    ]);
    expect(guide.updatedBy).toBe('');
    expect(guide.updatedAt).toBeNull();
  });

  it('returns the stored config when the doc exists', async () => {
    const stored = { skills: [], updatedBy: 'coach-uid', updatedAt: null };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => stored });

    await expect(getSkillGuide()).resolves.toEqual(stored);
  });
});
