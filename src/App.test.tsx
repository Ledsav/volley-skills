import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const signedIn = vi.hoisted(() => ({ value: false }));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    callback(signedIn.value ? { uid: 'u-1', email: 'user@example.com' } : null);
    return () => {};
  },
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('./firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('./auth/usersApi', () => ({
  ensureUserDoc: async () => ({ uid: 'u-1', email: 'user@example.com', role: 'member' }),
}));
vi.mock('./auth/access', () => ({
  resolveAccess: async () => ({ isSuperAdmin: false, sections: { exercises: false, trainings: false, guides: false } }),
}));

describe('App', () => {
  afterEach(() => {
    signedIn.value = false;
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
});
