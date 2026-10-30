import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authValue, clubAdminAccess, testClub } from '../test/authValue';
import { EMPTY_ONBOARDING } from './onboardingState';
import { WelcomeSheet } from './WelcomeSheet';

const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: () => useAuthMock() }));

const update = vi.fn();

function admin(over: Parameters<typeof authValue>[0] = {}) {
  return authValue({ access: clubAdminAccess, role: 'admin', club: testClub({ name: 'Pallavolo Verde' }), updateOnboarding: update, ...over });
}

describe('WelcomeSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue(admin());
  });

  it('renders nothing while onboarding is unknown, when welcomed, or without a club', () => {
    for (const over of [{ onboarding: null }, { onboarding: { ...EMPTY_ONBOARDING, welcomed: true } }, { club: null }]) {
      useAuthMock.mockReturnValue(admin(over));
      const { container, unmount } = render(<WelcomeSheet adminsAnyTeam />);
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByRole('dialog')).toBeNull();
      unmount();
    }
  });

  it('shows the title, four rows in order and a focused Continue for a club admin', async () => {
    render(<WelcomeSheet adminsAnyTeam />);
    expect(screen.getByRole('dialog', { name: 'Welcome to Pallavolo Verde' })).toBeInTheDocument();
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['Teams and players', 'Bring your coaches', 'Plan every session', 'Scout live']);
    const button = screen.getByRole('button', { name: 'Continue' });
    await waitFor(() => expect(button).toHaveFocus());
  });

  it('shows the title once, with no header buttons, and Continue as the only action', () => {
    render(<WelcomeSheet adminsAnyTeam />);
    expect(screen.getAllByText('Welcome to Pallavolo Verde')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('leaves out the sessions row for a coach without Trainings access', () => {
    useAuthMock.mockReturnValue(
      admin({ role: 'member', access: { isClubAdmin: false, sections: { exercises: false, trainings: false, guides: false } } }),
    );
    render(<WelcomeSheet adminsAnyTeam />);
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['Scout live']);
  });

  it('Continue writes once and the sheet stays gone even if the write rejects', async () => {
    update.mockRejectedValue(new Error('offline'));
    const { rerender } = render(<WelcomeSheet adminsAnyTeam />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ kind: 'welcomed' });
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<WelcomeSheet adminsAnyTeam />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape counts as Continue', () => {
    render(<WelcomeSheet adminsAnyTeam />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ kind: 'welcomed' });
  });

  it('a double click produces one call', () => {
    render(<WelcomeSheet adminsAnyTeam />);
    const button = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
