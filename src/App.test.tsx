import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const signedIn = vi.hoisted(() => ({ value: false, platform: false, memberships: true }));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    callback(signedIn.value ? { uid: 'u-1', email: 'user@example.com' } : null);
    return () => {};
  },
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('./firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('./auth/usersApi', () => ({
  ensureUserDoc: async () => ({ uid: 'u-1', email: 'user@example.com' }),
}));
vi.mock('./auth/access', () => ({
  resolveAccess: async () => ({ isClubAdmin: false, sections: { exercises: false, trainings: false, guides: false } }),
}));
vi.mock('./clubs/clubsApi', () => ({
  listMyMemberships: async () =>
    signedIn.memberships ? [{ clubId: 'club-1', role: 'member', clubName: 'Test Club', status: 'active' }] : [],
  probePlatformAdmin: async () => signedIn.platform,
  subscribeClub: (_id: string, onClub: (club: unknown) => void) => {
    onClub({ id: 'club-1', name: 'Test Club', status: 'active', termination: { requestedAt: null, requestedBy: null, effectiveAt: null, retrievalEndsAt: null } });
    return () => {};
  },
}));

vi.mock('./platform/platformApi', () => ({
  listClubs: async () => ({ clubs: [], lastDoc: null, hasMore: false }),
  changeClubStatus: vi.fn(),
}));

describe('App', () => {
  afterEach(() => {
    signedIn.value = false;
    signedIn.platform = false;
    signedIn.memberships = true;
  });

  it('/platform renders for a platform admin with no club membership', async () => {
    signedIn.value = true;
    signedIn.platform = true;
    signedIn.memberships = false;
    window.history.pushState({}, '', '/platform');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Platform' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('/platform denies a club admin who is not a platform admin', async () => {
    signedIn.value = true;
    window.history.pushState({}, '', '/platform');
    render(<App />);
    expect(await screen.findByText("You don't have access to this page.")).toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor at "/" to the login page', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
  });

  it('renders the public privacy page without authentication', async () => {
    window.history.pushState({}, '', '/privacy');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
  });

  it('renders the 404 page for an unknown URL', async () => {
    signedIn.value = true;
    window.history.pushState({}, '', '/does-not-exist');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'This page is out of bounds' })).toBeInTheDocument();
  });

  it('redirects /admin/access to /club?tab=people', async () => {
    signedIn.value = true;
    window.history.pushState({}, '', '/admin/access');
    render(<App />);
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/club?tab=people'));
  });
});
