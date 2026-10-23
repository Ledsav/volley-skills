import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupPage } from './SignupPage';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';
import { readSignDraft } from '../legal/signDraft';

vi.mock('../auth/AuthContext');
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn() }));
const sendSigningLink = vi.fn().mockResolvedValue(undefined);
vi.mock('../auth/reauth', () => ({ sendSigningLink: (...a: unknown[]) => sendSigningLink(...a) }));
const inForceSpy = vi.hoisted(() => vi.fn());
vi.mock('../legal/versions', async (orig) => {
  const real = await orig<typeof import('../legal/versions')>();
  inForceSpy.mockImplementation(real.inForce);
  return { ...real, inForce: (...a: Parameters<typeof real.inForce>) => inForceSpy(...a) };
});
vi.mock('./newClubId', () => ({ newClubId: () => 'abcdefghij0123456789' }));

const renderPage = () => render(<MemoryRouter><SignupPage /></MemoryRouter>);

function fill(over: { name?: string; authority?: boolean } = {}) {
  fireEvent.change(screen.getByLabelText('Club name'), { target: { value: over.name ?? 'Test VC' } });
  fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'BE' } });
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ann Coach' } });
  if (over.authority !== false) fireEvent.click(screen.getByRole('checkbox', { name: /authorised to act for this club/ }));
}

describe('SignupPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    sendSigningLink.mockClear();
    vi.mocked(useAuth).mockReturnValue(authValue({ memberships: [], activeClubId: null, club: null }));
  });

  it('rejects a club name shorter than 2 characters', () => {
    renderPage();
    fill({ name: 'A' });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/club name of 2 to 80 characters/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Club name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects a person name longer than 100 characters', () => {
    renderPage();
    fill();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'x'.repeat(101) } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/name \(1 to 100 characters\)/i)).toBeInTheDocument();
  });

  it('blocks Next while the authority box is unchecked', () => {
    renderPage();
    fill({ authority: false });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/authorised to act/i);
    expect(screen.getByLabelText('Club name')).toBeInTheDocument();
  });

  it('shows only the waiting notice when a pending club exists', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({
      memberships: [{ clubId: 'c', role: 'admin', clubName: 'New VC', status: 'pending' }],
    }));
    renderPage();
    expect(screen.getByText('You already have a club waiting for activation')).toBeInTheDocument();
    expect(screen.queryByLabelText('Club name')).not.toBeInTheDocument();
  });

  it('walks the three steps and saves the draft before sending the link', async () => {
    renderPage();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    for (const link of screen.getAllByRole('link', { name: /Open in a new tab/ })) {
      link.addEventListener('click', (e) => e.preventDefault());
      fireEvent.click(link);
    }
    fireEvent.click(screen.getByRole('checkbox', { name: /Terms of Service/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Data Processing Agreement/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve these clauses specifically' }));
    await waitFor(() => expect(sendSigningLink).toHaveBeenCalledWith('user@example.com'));
    const draft = readSignDraft(Date.now());
    expect(draft).toMatchObject({
      kind: 'signup', clubId: 'abcdefghij0123456789', email: 'user@example.com', personName: 'Ann Coach',
      club: { name: 'Test VC', country: 'BE', locale: 'en' }, language: 'en',
    });
  });
});

describe('SignupPage versions', () => {
  it('keeps the versions it had on mount after the clock passes a new effective date', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-23T10:00:00Z'));
    try {
      vi.mocked(useAuth).mockReturnValue(authValue({ memberships: [], activeClubId: null, club: null }));
      inForceSpy.mockClear();
      const { rerender } = renderPage();
      const calls = inForceSpy.mock.calls.length;
      expect(calls).toBeGreaterThan(0);
      vi.setSystemTime(new Date('2027-03-01T10:00:00Z'));
      rerender(<MemoryRouter><SignupPage /></MemoryRouter>);
      fireEvent.change(screen.getByLabelText('Club name'), { target: { value: 'Test VC' } });
      expect(inForceSpy.mock.calls.length).toBe(calls);
    } finally {
      vi.useRealTimers();
    }
  });
});
