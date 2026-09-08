import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: null) => void) => {
    callback(null);
    return () => {};
  },
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('./firebase/config', () => ({ auth: {}, db: {} }));

describe('App', () => {
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
});
