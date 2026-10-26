import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useClubFeatures } from './useClubFeatures';
import { useAuth } from '../auth/AuthContext';
import { authValue, testClub } from '../test/authValue';

vi.mock('../auth/AuthContext');

describe('useClubFeatures', () => {
  it('reads both flags from the active club', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ aiEnabled: true, growthTestsEnabled: false }) }));
    expect(renderHook(() => useClubFeatures()).result.current).toEqual({ aiEnabled: true, growthTestsEnabled: false });
    vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ aiEnabled: false, growthTestsEnabled: true }) }));
    expect(renderHook(() => useClubFeatures()).result.current).toEqual({ aiEnabled: false, growthTestsEnabled: true });
  });

  it('is all-off without a club', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ club: null }));
    expect(renderHook(() => useClubFeatures()).result.current).toEqual({ aiEnabled: false, growthTestsEnabled: false });
  });
});
