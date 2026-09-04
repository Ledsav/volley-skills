import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';

const mockSendSignInLinkToEmail = vi.fn();

vi.mock('firebase/auth', () => ({
  sendSignInLinkToEmail: (...args: unknown[]) => mockSendSignInLinkToEmail(...args),
}));

vi.mock('../firebase/config', () => ({ auth: {} }));

describe('LoginPage', () => {
  beforeEach(() => {
    mockSendSignInLinkToEmail.mockReset();
    window.localStorage.clear();
  });

  it('sends a sign-in link and shows a confirmation message', async () => {
    mockSendSignInLinkToEmail.mockResolvedValue(undefined);
    render(<LoginPage />);

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
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coach@example.com' } });
    fireEvent.click(screen.getByText('Send sign-in link'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
