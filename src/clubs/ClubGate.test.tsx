import { act, fireEvent, render, screen } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubGate } from './ClubGate';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess, testClub } from '../test/authValue';

vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('./clubAdminApi');
vi.mock('../access/membersApi');
vi.mock('../access/accessApi');
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn() }));

const NOW = new Date('2026-11-01T10:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('ClubGate', () => {
  it('switches from the app to the locked screen when effectiveAt passes while open', () => {
    const club = testClub({
      status: 'terminating',
      termination: {
        requestedAt: null,
        requestedBy: null,
        effectiveAt: Timestamp.fromMillis(NOW + 1000),
        retrievalEndsAt: Timestamp.fromMillis(NOW + 1000 + 30 * 86_400_000),
      },
    });
    vi.mocked(useAuth).mockReturnValue(authValue({ club }));
    render(
      <MemoryRouter>
        <ClubGate>
          <p>Protected content</p>
        </ClubGate>
      </MemoryRouter>
    );
    expect(screen.getByText('Protected content')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1001);
    });

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Your club's access is paused" })).toBeInTheDocument();
  });

  it('keeps the app open when effectiveAt is 60 days away, past the clamped timer', () => {
    const DAY = 86_400_000;
    const club = testClub({
      status: 'terminating',
      termination: {
        requestedAt: null,
        requestedBy: null,
        effectiveAt: Timestamp.fromMillis(NOW + 60 * DAY),
        retrievalEndsAt: Timestamp.fromMillis(NOW + 90 * DAY),
      },
    });
    vi.mocked(useAuth).mockReturnValue(authValue({ club }));
    render(
      <MemoryRouter>
        <ClubGate>
          <p>Protected content</p>
        </ClubGate>
      </MemoryRouter>
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Protected content')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(30 * DAY);
    });
    expect(screen.getByText('Protected content')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(30 * DAY);
    });
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('shows the restricted club area to an admin of a suspended club', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ club: testClub({ status: 'suspended' }), role: 'admin', access: clubAdminAccess })
    );
    render(
      <MemoryRouter>
        <ClubGate>
          <p>Protected content</p>
        </ClubGate>
      </MemoryRouter>
    );
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    // Opens on Contract, where the export-window dates are.
    expect(screen.getByRole('tab', { name: 'Contract' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'People & access' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Profile' }));
    for (const input of screen.getAllByRole('textbox')) expect(input).toBeDisabled();
  });
});
