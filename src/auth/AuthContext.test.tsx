import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { setActiveClubId } from '../firebase/activeClub';
import type { Club, Membership } from '../types/club';
import { EMPTY_ONBOARDING } from '../onboarding/onboardingState';

const h = vi.hoisted(() => ({
  user: { uid: 'coach-uid', email: 'coach@example.com' } as { uid: string; email: string } | null,
  authCallback: null as null | ((user: unknown) => void),
  clubCallback: null as null | ((club: unknown) => void),
  unsubscribeClub: vi.fn(),
  ensureUserDoc: vi.fn(),
  writeOnboarding: vi.fn(),
  resolveAccess: vi.fn(),
  listMyMemberships: vi.fn(),
  probePlatformAdmin: vi.fn(),
  subscribeClub: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    h.authCallback = callback;
    callback(h.user);
    return () => {};
  },
}));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../firebase/activeClub', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../firebase/activeClub')>()),
  setActiveClubId: vi.fn(),
}));
vi.mock('./usersApi', () => ({
  ensureUserDoc: (...a: unknown[]) => h.ensureUserDoc(...a),
  writeOnboarding: (...a: unknown[]) => h.writeOnboarding(...a),
}));
vi.mock('./access', () => ({
  resolveAccess: (...a: unknown[]) => h.resolveAccess(...a),
  SECTION_KEYS: ['exercises', 'trainings', 'guides'],
}));
vi.mock('../clubs/clubsApi', () => ({
  listMyMemberships: (...a: unknown[]) => h.listMyMemberships(...a),
  probePlatformAdmin: (...a: unknown[]) => h.probePlatformAdmin(...a),
  subscribeClub: (...a: unknown[]) => h.subscribeClub(...a),
}));

const membership = (clubId: string, role: Membership['role'] = 'member'): Membership => ({
  clubId, role, clubName: `Club ${clubId}`, status: 'active',
});
const club = (id: string, status: Club['status'] = 'active') => ({ id, name: `Club ${id}`, status }) as Club;

function Probe() {
  const { loading, appUser, access, authError, activeClubId, club, role, isPlatformAdmin, memberships, onboarding, updateOnboarding } = useAuth();
  return (
    <div>
      <p>loading: {String(loading)}</p>
      <p>appUser: {appUser ? appUser.email : 'none'}</p>
      <p>access: {access ? (access.isClubAdmin ? 'club-admin' : Object.entries(access.sections).filter(([, v]) => v).map(([k]) => k).join(',') || 'member') : 'none'}</p>
      <p>authError: {authError ?? 'none'}</p>
      <p>activeClub: {activeClubId ?? 'none'}</p>
      <p>club: {club ? `${club.id}/${club.status}` : 'none'}</p>
      <p>role: {role ?? 'none'}</p>
      <p>platformAdmin: {String(isPlatformAdmin)}</p>
      <p>memberships: {memberships.length}</p>
      <p>onboarding: {onboarding ? JSON.stringify(onboarding) : 'none'}</p>
      <button onClick={() => updateOnboarding({ kind: 'welcomed' })}>welcome</button>
    </div>
  );
}

const renderProvider = () => render(<AuthProvider><Probe /></AuthProvider>);

beforeEach(() => {
  h.user = { uid: 'coach-uid', email: 'coach@example.com' };
  h.clubCallback = null;
  h.unsubscribeClub.mockReset();
  h.ensureUserDoc.mockReset().mockImplementation(async (uid: string, email: string) => ({ uid, email, onboarding: EMPTY_ONBOARDING }));
  h.writeOnboarding.mockReset().mockResolvedValue(undefined);
  h.resolveAccess.mockReset().mockResolvedValue({
    isClubAdmin: false, sections: { exercises: true, trainings: false, guides: false },
  });
  h.listMyMemberships.mockReset().mockResolvedValue([membership('club-a')]);
  h.probePlatformAdmin.mockReset().mockResolvedValue(false);
  h.subscribeClub.mockReset().mockImplementation((_id: string, onClub: (c: unknown) => void) => {
    h.clubCallback = onClub;
    return h.unsubscribeClub;
  });
  vi.mocked(setActiveClubId).mockClear();
});
afterEach(() => localStorage.clear());

describe('AuthProvider', () => {
  it('stops loading and exposes authError when sign-in fails', async () => {
    h.ensureUserDoc.mockRejectedValueOnce({ code: 'unavailable' });

    renderProvider();

    await waitFor(() => expect(screen.getByText('loading: false')).toBeInTheDocument());
    expect(screen.getByText('appUser: none')).toBeInTheDocument();
    expect(screen.getByText('access: none')).toBeInTheDocument();
    expect(screen.getByText('authError: Could not finish signing you in.')).toBeInTheDocument();
  });

  it('lowercases the email before loading memberships', async () => {
    h.user = { uid: 'coach-uid', email: 'Coach@Example.COM' };
    renderProvider();

    await waitFor(() => expect(h.listMyMemberships).toHaveBeenCalledWith('coach@example.com'));
    expect(h.ensureUserDoc).toHaveBeenCalledWith('coach-uid', 'coach@example.com');
    expect(h.probePlatformAdmin).toHaveBeenCalledWith('coach@example.com');
  });

  it('sets the active club id for the API layer', async () => {
    h.listMyMemberships.mockResolvedValue([membership('club-b'), membership('club-a', 'admin')]);
    h.resolveAccess.mockResolvedValue({ isClubAdmin: true, sections: { exercises: true, trainings: true, guides: true } });
    renderProvider();

    await waitFor(() => expect(setActiveClubId).toHaveBeenCalledWith('club-a'));
    await waitFor(() => expect(h.subscribeClub).toHaveBeenCalledWith('club-a', expect.any(Function)));
    expect(h.resolveAccess).toHaveBeenCalledWith('admin');
    expect(localStorage.getItem('vcb.activeClub')).toBe('club-a');
    expect(screen.getByText('loading: true')).toBeInTheDocument();

    act(() => h.clubCallback!(club('club-a')));

    expect(screen.getByText('loading: false')).toBeInTheDocument();
    expect(screen.getByText('activeClub: club-a')).toBeInTheDocument();
    expect(screen.getByText('role: admin')).toBeInTheDocument();
    expect(screen.getByText('access: club-admin')).toBeInTheDocument();
    expect(screen.getByText('memberships: 2')).toBeInTheDocument();
    expect(screen.getByText('authError: none')).toBeInTheDocument();
  });

  it('follows live club updates', async () => {
    renderProvider();
    await waitFor(() => expect(h.clubCallback).not.toBeNull());

    act(() => h.clubCallback!(club('club-a')));
    expect(screen.getByText('club: club-a/active')).toBeInTheDocument();

    act(() => h.clubCallback!(club('club-a', 'suspended')));
    expect(screen.getByText('club: club-a/suspended')).toBeInTheDocument();
  });

  it('re-resolves section access when the club status becomes active', async () => {
    h.resolveAccess.mockResolvedValue({
      isClubAdmin: false, sections: { exercises: false, trainings: false, guides: false },
    });
    renderProvider();
    await waitFor(() => expect(h.clubCallback).not.toBeNull());
    act(() => h.clubCallback!(club('club-a', 'pending')));
    expect(screen.getByText('access: member')).toBeInTheDocument();
    expect(h.resolveAccess).toHaveBeenCalledTimes(1);

    h.resolveAccess.mockResolvedValue({
      isClubAdmin: false, sections: { exercises: true, trainings: false, guides: false },
    });
    act(() => h.clubCallback!(club('club-a', 'active')));

    await waitFor(() => expect(screen.getByText('access: exercises')).toBeInTheDocument());
    expect(h.resolveAccess).toHaveBeenCalledTimes(2);
    expect(h.resolveAccess).toHaveBeenLastCalledWith('member');

    act(() => h.clubCallback!(club('club-a', 'active')));
    expect(h.resolveAccess).toHaveBeenCalledTimes(2);
  });

  it('keeps the latest access when status changes overlap', async () => {
    renderProvider();
    await waitFor(() => expect(h.clubCallback).not.toBeNull());
    act(() => h.clubCallback!(club('club-a', 'active')));

    let resolveSlow: (a: unknown) => void = () => {};
    h.resolveAccess
      .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r; }))
      .mockResolvedValueOnce({ isClubAdmin: false, sections: { exercises: false, trainings: true, guides: false } });
    act(() => h.clubCallback!(club('club-a', 'suspended')));
    act(() => h.clubCallback!(club('club-a', 'active')));
    await waitFor(() => expect(screen.getByText('access: trainings')).toBeInTheDocument());

    await act(async () => resolveSlow({ isClubAdmin: false, sections: { exercises: false, trainings: false, guides: true } }));
    expect(screen.getByText('access: trainings')).toBeInTheDocument();
  });

  it('has no active club and no access when the person has no memberships', async () => {
    h.listMyMemberships.mockResolvedValue([]);
    renderProvider();

    await waitFor(() => expect(screen.getByText('loading: false')).toBeInTheDocument());
    expect(screen.getByText('appUser: coach@example.com')).toBeInTheDocument();
    expect(screen.getByText('activeClub: none')).toBeInTheDocument();
    expect(screen.getByText('club: none')).toBeInTheDocument();
    expect(screen.getByText('role: none')).toBeInTheDocument();
    expect(screen.getByText('access: none')).toBeInTheDocument();
    expect(setActiveClubId).toHaveBeenCalledWith(null);
    expect(h.resolveAccess).not.toHaveBeenCalled();
    expect(h.subscribeClub).not.toHaveBeenCalled();
  });

  it('exposes isPlatformAdmin', async () => {
    h.listMyMemberships.mockResolvedValue([]);
    h.probePlatformAdmin.mockResolvedValue(true);
    renderProvider();

    await waitFor(() => expect(screen.getByText('platformAdmin: true')).toBeInTheDocument());
  });

  it('unsubscribes from the club and clears the active club on sign-out', async () => {
    renderProvider();
    await waitFor(() => expect(h.clubCallback).not.toBeNull());
    act(() => h.clubCallback!(club('club-a')));

    await act(async () => h.authCallback!(null));

    expect(h.unsubscribeClub).toHaveBeenCalled();
    expect(setActiveClubId).toHaveBeenLastCalledWith(null);
    expect(screen.getByText('activeClub: none')).toBeInTheDocument();
    expect(screen.getByText('club: none')).toBeInTheDocument();
    expect(screen.getByText('appUser: none')).toBeInTheDocument();
  });

  it('exposes onboarding from the user doc, and null before it and when signed out', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByText(`onboarding: ${JSON.stringify(EMPTY_ONBOARDING)}`)).toBeInTheDocument());

    await act(async () => h.authCallback!(null));
    expect(screen.getByText('onboarding: none')).toBeInTheDocument();
  });

  it('updateOnboarding changes the session at once and writes without waiting', async () => {
    h.writeOnboarding.mockReturnValue(new Promise(() => {}));
    renderProvider();
    await waitFor(() => expect(screen.getByText(/onboarding: \{/)).toBeInTheDocument());

    act(() => screen.getByText('welcome').click());

    expect(screen.getByText(/"welcomed":true/)).toBeInTheDocument();
    expect(h.writeOnboarding).toHaveBeenCalledWith('coach-uid', { kind: 'welcomed' });
  });

  it('keeps the local change when the write is rejected', async () => {
    h.writeOnboarding.mockRejectedValue({ code: 'permission-denied' });
    renderProvider();
    await waitFor(() => expect(screen.getByText(/onboarding: \{/)).toBeInTheDocument());

    await act(async () => screen.getByText('welcome').click());

    expect(screen.getByText(/"welcomed":true/)).toBeInTheDocument();
  });
});
