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

vi.mock('../firebase/config', () => ({ auth: {} as { languageCode?: string } }));

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
      expect.objectContaining({}),
      'coach@example.com',
      expect.objectContaining({ handleCodeInApp: true })
    );
    expect(window.localStorage.getItem('emailForSignIn')).toBe('coach@example.com');
  });

  it('sets auth.languageCode to the active locale before sending the link', async () => {
    const { auth } = await import('../firebase/config');
    let seen: string | null | undefined;
    mockSendSignInLinkToEmail.mockImplementation(async () => { seen = auth.languageCode; });
    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coach@example.com' } });
    fireEvent.click(screen.getByText('Send sign-in link'));
    await waitFor(() => expect(seen).toBe('en'));
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

    await waitFor(() => expect(mockSignInWithPopup).toHaveBeenCalledWith(expect.objectContaining({}), {}));
  });

  it('navigates to / after a successful Google sign-in', async () => {
    mockSignInWithPopup.mockResolvedValue(undefined);
    renderLoginPage();

    fireEvent.click(screen.getByText('Continue with Google'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
  });

  it('shows an error message when Google sign-in fails', async () => {
    mockSignInWithPopup.mockRejectedValue(new Error('popup closed'));
    renderLoginPage();

    fireEvent.click(screen.getByText('Continue with Google'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});

describe('LoginPage sign-up link', () => {
  it('links to the club sign-up', () => {
    renderLoginPage();
    expect(screen.getByRole('link', { name: 'Create your club' })).toHaveAttribute('href', '/signup');
  });
});

describe('LoginPage v2 states', () => {
  async function sendFor(address: string) {
    mockSendSignInLinkToEmail.mockResolvedValue(undefined);
    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: address } });
    fireEvent.click(screen.getByText('Send sign-in link'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument());
  }

  it('check your email tells the coach to open the link on this device', async () => {
    await sendFor('coach@example.com');
    expect(screen.getByText(/Open it on this device\./)).toBeInTheDocument();
  });

  it('a long email wraps inside the status layout', async () => {
    const long = 'a.very.long.coach.name@some-really-long-club-domain.example';
    await sendFor(long);
    expect(screen.getByText(long).tagName).toBe('B');
    expect(screen.getByText(long)).toHaveClass('break-all');
  });

  it('links Request early access to the request form', () => {
    renderLoginPage();
    expect(screen.getByRole('link', { name: 'Request early access' })).toHaveAttribute('href', '/request-access');
  });
});
