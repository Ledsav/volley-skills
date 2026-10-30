import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authValue } from '../test/authValue';
import { useTip } from './useTip';

const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: () => useAuthMock() }));
const update = vi.fn();

describe('useTip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dismiss on an invisible tip makes no write', () => {
    useAuthMock.mockReturnValue(authValue({ updateOnboarding: update, onboarding: { welcomed: true, tips: ['row-actions'], hiddenChecklists: [] } }));
    const { result } = renderHook(() => useTip('row-actions'));
    expect(result.current.visible).toBe(false);
    act(() => result.current.dismiss());
    expect(update).not.toHaveBeenCalled();
  });

  it('dismiss on a visible tip writes once and hides it', () => {
    useAuthMock.mockReturnValue(authValue({ updateOnboarding: update, onboarding: { welcomed: true, tips: [], hiddenChecklists: [] } }));
    const { result } = renderHook(() => useTip('row-actions'));
    expect(result.current.visible).toBe(true);
    act(() => result.current.dismiss());
    act(() => result.current.dismiss());
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ kind: 'tip', id: 'row-actions' });
    expect(result.current.visible).toBe(false);
  });
});
