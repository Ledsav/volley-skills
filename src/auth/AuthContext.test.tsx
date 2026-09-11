import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const mockEnsureUserDoc = vi.fn();
const mockResolveAccess = vi.fn();

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    callback({ uid: 'coach-uid', email: 'coach@example.com' });
    return () => {};
  },
}));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('./usersApi', () => ({ ensureUserDoc: (...args: unknown[]) => mockEnsureUserDoc(...args) }));
vi.mock('./access', () => ({
  resolveAccess: (...args: unknown[]) => mockResolveAccess(...args),
  SECTION_KEYS: ['exercises', 'trainings', 'guides'],
}));

function Probe() {
  const { loading, appUser, access, authError } = useAuth();
  return (
    <div>
      <p>loading: {String(loading)}</p>
      <p>appUser: {appUser ? appUser.role : 'none'}</p>
      <p>access: {access ? (access.isSuperAdmin ? 'super' : Object.entries(access.sections).filter(([, v]) => v).map(([k]) => k).join(',') || 'member') : 'none'}</p>
      <p>authError: {authError ?? 'none'}</p>
    </div>
  );
}

describe('AuthProvider', () => {
  it('stops loading and exposes authError when role resolution rethrows', async () => {
    mockEnsureUserDoc.mockRejectedValueOnce({ code: 'unavailable' });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('loading: false')).toBeInTheDocument());
    expect(screen.getByText('appUser: none')).toBeInTheDocument();
    expect(screen.getByText('access: none')).toBeInTheDocument();
    expect(screen.getByText('authError: Could not finish signing you in.')).toBeInTheDocument();
  });

  it('resolves the app user and access, leaving authError null on success', async () => {
    mockEnsureUserDoc.mockResolvedValueOnce({ uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' });
    mockResolveAccess.mockResolvedValueOnce({
      isSuperAdmin: true, sections: { exercises: true, trainings: true, guides: true },
    });

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByText('appUser: superadmin')).toBeInTheDocument());
    expect(screen.getByText('access: super')).toBeInTheDocument();
    expect(screen.getByText('authError: none')).toBeInTheDocument();
  });
});
