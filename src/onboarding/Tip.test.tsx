import { act, fireEvent, render, screen } from '@testing-library/react';
import { Search } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  describe('motion', () => {
    let animate: ReturnType<typeof vi.fn>;
    let finish: (() => void) | null;
    beforeEach(() => {
      finish = null;
      animate = vi.fn(() => ({
        addEventListener: (type: string, fn: () => void) => {
          if (type === 'finish') finish = fn;
        },
      }));
      Object.defineProperty(Element.prototype, 'animate', { configurable: true, writable: true, value: animate });
    });
    afterEach(() => {
      delete (Element.prototype as { animate?: unknown }).animate;
      vi.unstubAllGlobals();
    });

    it('enters when it becomes visible later, and collapses before it unmounts', () => {
      useAuthMock.mockReturnValue(authValue({ onboarding: EMPTY_ONBOARDING, updateOnboarding: update }));
      const { rerender } = render(tip());
      expect(animate).not.toHaveBeenCalled();
      useAuthMock.mockReturnValue(authValue({ onboarding: welcomed, updateOnboarding: update }));
      rerender(tip());
      expect(animate).toHaveBeenCalledTimes(1);
      expect((animate.mock.calls[0] as unknown[][])[0]).toEqual([
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ]);
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss tip' }));
      expect(animate).toHaveBeenCalledTimes(2);
      const frames = (animate.mock.calls[1] as unknown[][])[0] as Record<string, unknown>[];
      expect(frames[1]).toMatchObject({ opacity: 0, height: '0px' });
      expect((animate.mock.calls[1] as unknown[][])[1]).toMatchObject({ duration: 200 });
      expect(screen.getByText('Find anything')).toBeInTheDocument();
      act(() => finish?.());
      expect(screen.queryByText('Find anything')).toBeNull();
    });

    it('cross-fades with reduced motion', () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener: () => {}, removeEventListener: () => {} }));
      render(tip());
      expect((animate.mock.calls[0] as unknown[][])[0]).toEqual([{ opacity: 0 }, { opacity: 1 }]);
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss tip' }));
      expect((animate.mock.calls[1] as unknown[][])[0]).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    });

    it('animated={false} never animates and disappears at once', () => {
      render(<Tip id="scout-start" icon={Search} title="How" line="x" animated={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss tip' }));
      expect(animate).not.toHaveBeenCalled();
      expect(screen.queryByText('How')).toBeNull();
    });
  });
});
