import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignCompletePage } from './SignCompletePage';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';
import { saveSignDraft } from '../legal/signDraft';

vi.mock('../auth/AuthContext');
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn() }));
const commitSignDraft = vi.fn();
vi.mock('./signingApi', () => ({ commitSignDraft: (...a: unknown[]) => commitSignDraft(...a) }));
const sendSigningLink = vi.fn().mockResolvedValue(undefined);
vi.mock('../auth/reauth', () => ({ sendSigningLink: (...a: unknown[]) => sendSigningLink(...a) }));

const assign = vi.fn();
const NONCE = '0123456789abcdef0123456789abcdef';
const renderPage = (strict = false, path = `/sign/complete?sign=${NONCE}`) => {
  const page = <MemoryRouter initialEntries={[path]}><SignCompletePage /></MemoryRouter>;
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
};

describe('SignCompletePage', () => {
  beforeEach(() => {
    commitSignDraft.mockReset();
    sendSigningLink.mockClear();
    assign.mockClear();
    window.localStorage.clear();
    Object.defineProperty(window, 'location', { value: { ...window.location, assign }, writable: true, configurable: true });
    vi.mocked(useAuth).mockReturnValue(authValue());
  });

  it.each(['done', 'alreadyDone'])('goes to the app on %s', async (outcome) => {
    commitSignDraft.mockResolvedValue(outcome);
    renderPage();
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
    expect(commitSignDraft).toHaveBeenCalledWith(NONCE);
  });

  it('passes no nonce when the link has none', async () => {
    commitSignDraft.mockResolvedValue('wrongLink');
    renderPage(false, '/sign/complete');
    await waitFor(() => expect(commitSignDraft).toHaveBeenCalledWith(null));
  });

  it('says the link does not match the signing in this browser', async () => {
    commitSignDraft.mockResolvedValue('wrongLink');
    renderPage();
    expect(await screen.findByText(/doesn.t match the signing in progress in this browser/)).toBeInTheDocument();
  });

  it('offers a new link when it expired', async () => {
    commitSignDraft.mockResolvedValue('linkExpired');
    saveSignDraft({
      kind: 'reaccept', clubId: 'c', email: 'user@example.com', personName: 'A', termsVersion: '1', dpaVersion: '1',
      subprocessorsVersion: '1', language: 'en', savedAt: Date.now(), nonce: NONCE,
    });
    renderPage();
    expect(await screen.findByText(/The link is older than 15 minutes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send a new link' }));
    await waitFor(() => expect(sendSigningLink).toHaveBeenCalledWith('user@example.com', NONCE));
  });

  it('says there is no signing in this browser without a draft (also true after success)', async () => {
    commitSignDraft.mockResolvedValue('noDraft');
    renderPage();
    expect(await screen.findByText(/There is no signing in progress in this browser/)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing was saved/)).not.toBeInTheDocument();
  });

  it('says it is another account', async () => {
    commitSignDraft.mockResolvedValue('wrongAccount');
    renderPage();
    expect(await screen.findByText(/Signed in as another account/)).toBeInTheDocument();
  });

  it('shows an alert on an unexpected error', async () => {
    commitSignDraft.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('commits without relying on the context user (it can be stale after a re-sign-in)', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: null }));
    commitSignDraft.mockResolvedValue('done');
    renderPage();
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
    expect(commitSignDraft).toHaveBeenCalledTimes(1);
  });

  it('commits once under StrictMode', async () => {
    commitSignDraft.mockResolvedValue('done');
    renderPage(true);
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(commitSignDraft).toHaveBeenCalledTimes(1);
  });
});

describe('SignCompletePage status layout', () => {
  it('every view keeps the Completing sign-up heading', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    commitSignDraft.mockResolvedValue('wrongLink');
    renderPage();
    await screen.findByText(/doesn.t match the signing in progress in this browser/);
    const h = screen.getByRole('heading', { name: 'Completing sign-up' });
    expect(h).toHaveAttribute('tabindex', '-1');
  });
});
