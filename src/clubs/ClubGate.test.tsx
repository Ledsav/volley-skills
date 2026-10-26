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

  describe('legal review', () => {
    const current = { versionKey: 'terms-2026-10-22_dpa-2026-10-22', acceptedAt: null, acceptedBy: 'owner@example.com' };
    const renderGate = () =>
      render(
        <MemoryRouter>
          <ClubGate>
            <p>Protected content</p>
          </ClubGate>
        </MemoryRouter>
      );

    it('blocks an admin whose club has not accepted with the accept screen', () => {
      vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ legal: null }), role: 'admin', access: clubAdminAccess }));
      renderGate();
      expect(screen.getByRole('heading', { name: 'Accept the Terms and DPA' })).toBeInTheDocument();
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    });

    it('shows a member the app even when the club has not accepted', () => {
      vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ legal: null }), role: 'member' }));
      renderGate();
      expect(screen.getByText('Protected content')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Accept the Terms and DPA' })).not.toBeInTheDocument();
    });

    it('gives a club admin who is also the platform admin the same accept screen', () => {
      vi.mocked(useAuth).mockReturnValue(
        authValue({ club: testClub({ legal: null }), role: 'admin', access: clubAdminAccess, isPlatformAdmin: true })
      );
      renderGate();
      expect(screen.getByRole('heading', { name: 'Accept the Terms and DPA' })).toBeInTheDocument();
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    });

    it('lets an admin through with a notice once the club has ended the contract', () => {
      const club = testClub({
        legal: null,
        termination: { requestedAt: Timestamp.fromMillis(NOW - 1000), requestedBy: 'a@example.com', effectiveAt: null, retrievalEndsAt: null },
      });
      vi.mocked(useAuth).mockReturnValue(authValue({ club, role: 'admin', access: clubAdminAccess }));
      renderGate();
      expect(screen.getByText('Protected content')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Your club ended the contract instead of accepting the updated terms. The terms you accepted apply until it ends.'
      );
      expect(screen.queryByRole('heading', { name: 'Accept the Terms and DPA' })).not.toBeInTheDocument();
    });

    it('shows an admin with the current key the app', () => {
      vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ legal: current }), role: 'admin', access: clubAdminAccess }));
      renderGate();
      expect(screen.getByText('Protected content')).toBeInTheDocument();
    });

    it('titles the screen as a review when an older version was accepted', () => {
      vi.mocked(useAuth).mockReturnValue(
        authValue({ club: testClub({ legal: { ...current, versionKey: 'terms-2026-01-01_dpa-2026-01-01' } }), role: 'admin', access: clubAdminAccess })
      );
      renderGate();
      expect(screen.getByRole('heading', { name: 'Review the updated Terms and DPA' })).toBeInTheDocument();
    });
  });
});
