import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ensureUserDoc, writeOnboarding } from './usersApi';
import { EMPTY_ONBOARDING } from '../onboarding/onboardingState';

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...p: string[]) => p.join('/')),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  arrayUnion: (...v: unknown[]) => ({ union: v }),
  arrayRemove: (...v: unknown[]) => ({ remove: v }),
  serverTimestamp: () => 'server-ts',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('ensureUserDoc', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('returns the user without rewriting an existing (even legacy) doc', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ email: 'coach@example.com', role: 'superadmin' }),
    });

    const result = await ensureUserDoc('uid-1', 'coach@example.com');

    expect(result).toEqual({ uid: 'uid-1', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('creates the user doc with email and createdAt only', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const result = await ensureUserDoc('uid-2', 'coach@example.com');

    expect(result).toEqual({ uid: 'uid-2', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).toHaveBeenCalledWith('users/uid-2', {
      email: 'coach@example.com',
      createdAt: 'server-ts',
    });
  });

  it('rethrows a failed write', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockRejectedValueOnce({ code: 'permission-denied' });

    await expect(ensureUserDoc('uid-3', 'coach@example.com')).rejects.toEqual({ code: 'permission-denied' });
  });
});

describe('ensureUserDoc onboarding', () => {
  beforeEach(() => mockGetDoc.mockReset());

  it('parses the stored onboarding map, safely', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ email: 'a@b.c', onboarding: { welcomed: true, tips: ['search'], hiddenChecklists: 'x' } }),
    });
    const result = await ensureUserDoc('uid-4', 'a@b.c');
    expect(result.onboarding).toEqual({ welcomed: true, tips: ['search'], hiddenChecklists: [] });
  });
});

describe('writeOnboarding', () => {
  beforeEach(() => mockUpdateDoc.mockReset().mockResolvedValue(undefined));

  it('writes welcomed as a field path', async () => {
    await writeOnboarding('u1', { kind: 'welcomed' });
    expect(mockUpdateDoc).toHaveBeenCalledWith('users/u1', { 'onboarding.welcomed': true });
  });

  it('adds a tip with arrayUnion', async () => {
    await writeOnboarding('u1', { kind: 'tip', id: 'search' });
    expect(mockUpdateDoc).toHaveBeenCalledWith('users/u1', { 'onboarding.tips': { union: ['search'] } });
  });

  it('hides with arrayUnion and shows with arrayRemove', async () => {
    await writeOnboarding('u1', { kind: 'hideChecklist', clubId: 'c1' });
    expect(mockUpdateDoc).toHaveBeenLastCalledWith('users/u1', { 'onboarding.hiddenChecklists': { union: ['c1'] } });
    await writeOnboarding('u1', { kind: 'showChecklist', clubId: 'c1' });
    expect(mockUpdateDoc).toHaveBeenLastCalledWith('users/u1', { 'onboarding.hiddenChecklists': { remove: ['c1'] } });
  });

  it('resets welcome and tips and unhides one club', async () => {
    await writeOnboarding('u1', { kind: 'reset', clubId: 'c1' });
    expect(mockUpdateDoc).toHaveBeenCalledWith('users/u1', {
      'onboarding.welcomed': false,
      'onboarding.tips': [],
      'onboarding.hiddenChecklists': { remove: ['c1'] },
    });
  });
});
