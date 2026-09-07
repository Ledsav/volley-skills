import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getPhysicalTestGuide, updatePhysicalTestGuide, DEFAULT_PHYSICAL_TEST_GUIDE } from './physicalTestGuideApi';

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('physicalTestGuideApi', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('falls back to the default guide when no doc exists yet', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const guide = await getPhysicalTestGuide();

    expect(guide.tests).toEqual(DEFAULT_PHYSICAL_TEST_GUIDE);
    expect(guide.tests).toHaveLength(8);
  });

  it('returns the stored guide when one exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ tests: [{ key: 'cmj', label: 'CMJ', protocol: 'Custom protocol' }], updatedBy: 'coach-uid', updatedAt: null }),
    });

    const guide = await getPhysicalTestGuide();

    expect(guide.tests).toEqual([{ key: 'cmj', label: 'CMJ', protocol: 'Custom protocol' }]);
  });

  it('saves the guide with a server timestamp', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    await updatePhysicalTestGuide(DEFAULT_PHYSICAL_TEST_GUIDE, 'coach-uid');

    expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', {
      tests: DEFAULT_PHYSICAL_TEST_GUIDE,
      updatedBy: 'coach-uid',
      updatedAt: 'server-timestamp',
    });
  });
});
