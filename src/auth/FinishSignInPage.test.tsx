import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinishSignInPage } from './FinishSignInPage';
import { saveSignDraft } from '../legal/signDraft';

const fb = vi.hoisted(() => ({ isLink: vi.fn(() => true), signIn: vi.fn() }));
vi.mock('firebase/auth', () => ({
  isSignInWithEmailLink: () => fb.isLink(),
  signInWithEmailLink: (...a: unknown[]) => fb.signIn(...a),
}));
vi.mock('../firebase/config', () => ({ auth: {} }));

const NONCE = '0123456789abcdef0123456789abcdef';

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function renderAt(href: string) {
  window.history.replaceState({}, '', href);
  return render(
    <MemoryRouter initialEntries={['/finish-sign-in']}>
      <Routes>
        <Route path="/finish-sign-in" element={<FinishSignInPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FinishSignInPage', () => {
  beforeEach(() => {
    localStorage.clear();
    fb.signIn.mockReset().mockResolvedValue({});
    localStorage.setItem('emailForSignIn', 'a@b.c');
  });

  it('goes to /sign/complete with the nonce for a signing link, and drops a stale return path', async () => {
    localStorage.setItem('vcb.auth.returnTo', '/teams/t1');
    renderAt(`/finish-sign-in?sign=${NONCE}&apiKey=k&oobCode=c&mode=signIn&lang=en`);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(`/sign/complete?sign=${NONCE}`));
    expect(fb.signIn).toHaveBeenCalledWith({}, 'a@b.c', expect.stringContaining(`sign=${NONCE}`));
    expect(localStorage.getItem('vcb.auth.returnTo')).toBeNull();
  });

  it('sends an ordinary sign-in to its return path even after an abandoned signing attempt', async () => {
    saveSignDraft({
      kind: 'reaccept', clubId: 'c', email: 'a@b.c', personName: 'A', termsVersion: '1', dpaVersion: '1',
      subprocessorsVersion: '1', language: 'en', savedAt: Date.now(), nonce: NONCE,
    });
    localStorage.setItem('vcb.auth.returnTo', '/teams/t1');
    renderAt('/finish-sign-in?apiKey=k&oobCode=c&mode=signIn&lang=en');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/teams/t1'));
  });

  it('ignores a malformed sign parameter', async () => {
    renderAt('/finish-sign-in?sign=..%2Fadmin&apiKey=k&oobCode=c&mode=signIn');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/));
  });
});

describe('FinishSignInPage error state', () => {
  it('an email-link error shows the alert with no action', async () => {
    fb.isLink.mockReturnValueOnce(false);
    renderAt('/finish-sign-in');
    expect(await screen.findByRole('alert')).toHaveTextContent('This sign-in link is invalid or has expired.');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
