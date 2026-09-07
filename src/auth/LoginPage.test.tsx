import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';

const mockSendSignInLinkToEmail = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockNavigate = vi.fn();

vi.mock('firebase/auth', () => ({
  sendSignInLinkToEmail: (...args: unknown[]) => mockSendSignInLinkToEmail(...args),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../firebase/config', () => ({ auth: {} }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockSendSignInLinkToEmail.mockReset();
    mockSignInWithPopup.mockReset();
    mockNavigate.mockReset();
    window.localStorage.clear();
  });

  it('sends a sign-in link and shows a confirmation message', async () => {
    mockSendSignInLinkToEmail.mockResolvedValue(undefined);
    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coach@example.com' } });
    fireEvent.click(screen.getByText('Send sign-in link'));

    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument());
    expect(mockSendSignInLinkToEmail).toHaveBeenCalledWith(
      {},
      'coach@example.com',
      expect.objectContaining({ handleCodeInApp: true })
    );
    expect(window.localStorage.getItem('emailForSignIn')).toBe('coach@example.com');
  });

  it('shows an error message when sending the link fails', async () => {
    mockSendSignInLinkToEmail.mockRejectedValue(new Error('network error'));
    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coach@example.com' } });
    fireEvent.click(screen.getByText('Send sign-in link'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('signs in with Google when the button is clicked', async () => {
    mockSignInWithPopup.mockResolvedValue(undefined);
    renderLoginPage();

    fireEvent.click(screen.getByText('Continue with Google'));

    await waitFor(() => expect(mockSignInWithPopup).toHaveBeenCalledWith({}, {}));
  });

  it('navigates to /teams after a successful Google sign-in', async () => {
    mockSignInWithPopup.mockResolvedValue(undefined);
    renderLoginPage();

    fireEvent.click(screen.getByText('Continue with Google'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/teams', { replace: true }));
  });

  it('shows an error message when Google sign-in fails', async () => {
    mockSignInWithPopup.mockRejectedValue(new Error('popup closed'));
    renderLoginPage();

    fireEvent.click(screen.getByText('Continue with Google'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
