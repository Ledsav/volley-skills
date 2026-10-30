import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireAuth, RequireSignedIn } from './RequireAuth';
import { useAuth } from './AuthContext';
import { authValue, clubAdminAccess, testClub } from '../test/authValue';

import { EMPTY_ONBOARDING } from '../onboarding/onboardingState';
vi.mock('./AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../clubs/clubAdminApi');
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn() }));

function renderGuard() {
  return render(
    <MemoryRouter>
      <RequireAuth>
        <p>Protected content</p>
      </RequireAuth>
    </MemoryRouter>
  );
}

describe('RequireAuth', () => {
  it('shows a recoverable error instead of loading forever when auth resolution failed', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: null, appUser: null, access: null, authError: 'Could not finish signing you in.' })
    );

    renderGuard();

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong signing you in.');
    expect(screen.getByText('Try again')).toHaveAttribute('href', '/login');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders the protected content for a signed-in user', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
        access: clubAdminAccess,
      })
    );

    renderGuard();

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('remembers the requested deep link before redirecting to login', () => {
    localStorage.clear();
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: null, appUser: null, access: null }));

    render(
      <MemoryRouter initialEntries={['/teams/t1/matches/m1?x=1']}>
        <RequireAuth>
          <p>Protected content</p>
        </RequireAuth>
      </MemoryRouter>
    );

    expect(localStorage.getItem('vcb.auth.returnTo')).toBe('/teams/t1/matches/m1?x=1');
    localStorage.clear();
  });
});

describe('ClubGate through RequireAuth', () => {
  const suspended = () => testClub({ status: 'suspended' });

  it('renders the app for an active club', () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    renderGuard();
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it("shows the welcome page with the person's email when there is no club", () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ memberships: [], activeClubId: null, club: null, role: null })
    );
    renderGuard();
    expect(screen.getByRole('heading', { name: 'Welcome to Volley Skills' })).toBeInTheDocument();
    expect(screen.getByText(/Ask your club admin to add user@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('shows the pending screen', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ status: 'pending' }) }));
    renderGuard();
    expect(screen.getByRole('heading', { name: 'Your club is waiting for activation' })).toBeInTheDocument();
    expect(screen.getByText(/Test Club/)).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('locks out a member of a suspended club', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ club: suspended() }));
    renderGuard();
    expect(screen.getByRole('heading', { name: "Your club's access is paused" })).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('shows the restricted club area to an admin of a suspended club', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ club: suspended(), role: 'admin', access: clubAdminAccess }));
    renderGuard();
    expect(screen.getByRole('tab', { name: 'Contract' })).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('switches to the locked screen when the club changes while open', () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    const { rerender } = renderGuard();
    expect(screen.getByText('Protected content')).toBeInTheDocument();
    vi.mocked(useAuth).mockReturnValue(authValue({ club: suspended() }));
    rerender(
      <MemoryRouter>
        <RequireAuth>
          <p>Protected content</p>
        </RequireAuth>
      </MemoryRouter>
    );
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Your club's access is paused" })).toBeInTheDocument();
  });
});

describe('RequireSignedIn', () => {
  it('renders its content for a signed-in person with no club, without the club gate', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ memberships: [], activeClubId: null, club: null, role: null, isPlatformAdmin: true })
    );
    render(
      <MemoryRouter>
        <RequireSignedIn>
          <p>Platform content</p>
        </RequireSignedIn>
      </MemoryRouter>
    );
    expect(screen.getByText('Platform content')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Welcome to Volley Skills' })).not.toBeInTheDocument();
  });
});
