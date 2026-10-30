import { act, fireEvent, render, screen } from '@testing-library/react';
import { Search } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authValue } from '../test/authValue';
import { EMPTY_ONBOARDING } from './onboardingState';
import { Tip } from './Tip';

const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: () => useAuthMock() }));

const update = vi.fn();
const welcomed = { ...EMPTY_ONBOARDING, welcomed: true };

function tip() {
  return <Tip id="search" icon={Search} title="Find anything" line="Press Ctrl K." />;
}

describe('Tip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue(authValue({ onboarding: welcomed, updateOnboarding: update }));
  });

  it('is not rendered before the welcome, or while onboarding is unknown', () => {
    for (const onboarding of [EMPTY_ONBOARDING, null]) {
      useAuthMock.mockReturnValue(authValue({ onboarding, updateOnboarding: update }));
      const { container, unmount } = render(tip());
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it('is rendered for a welcomed user who has not seen it', () => {
    render(tip());
    expect(screen.getByText('Find anything')).toBeInTheDocument();
    expect(screen.getByText('Press Ctrl K.')).toBeInTheDocument();
  });

  it('is not rendered when its id is already in tips', () => {
    useAuthMock.mockReturnValue(authValue({ onboarding: { ...welcomed, tips: ['search'] }, updateOnboarding: update }));
    const { container } = render(tip());
    expect(container).toBeEmptyDOMElement();
  });

  it('x writes the tip once and it stays gone on rerender after a rejected write', async () => {
    update.mockRejectedValue(new Error('offline'));
    const { rerender } = render(tip());
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss tip' }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ kind: 'tip', id: 'search' });
    await act(async () => {});
    expect(screen.queryByText('Find anything')).toBeNull();
    rerender(tip());
    expect(screen.queryByText('Find anything')).toBeNull();
  });

  it('follows a dismissal made elsewhere (the context drops the id into tips)', () => {
    const { rerender } = render(tip());
    useAuthMock.mockReturnValue(authValue({ onboarding: { ...welcomed, tips: ['search'] }, updateOnboarding: update }));
    rerender(tip());
    expect(screen.queryByText('Find anything')).toBeNull();
  });
});
