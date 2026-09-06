import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const mockEnsureUserDoc = vi.fn();

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    callback({ uid: 'coach-uid', email: 'coach@example.com' });
    return () => {};
  },
}));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('./usersApi', () => ({ ensureUserDoc: (...args: unknown[]) => mockEnsureUserDoc(...args) }));

function Probe() {
  const { loading, appUser, authError } = useAuth();
  return (
    <div>
      <p>loading: {String(loading)}</p>
      <p>appUser: {appUser ? appUser.role : 'none'}</p>
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
    expect(screen.getByText('authError: Could not finish signing you in.')).toBeInTheDocument();
  });

  it('resolves the app user and leaves authError null on success', async () => {
    mockEnsureUserDoc.mockResolvedValueOnce({ uid: 'coach-uid', email: 'coach@example.com', role: 'admin' });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('appUser: admin')).toBeInTheDocument());
    expect(screen.getByText('authError: none')).toBeInTheDocument();
    expect(screen.getByText('loading: false')).toBeInTheDocument();
  });
});
