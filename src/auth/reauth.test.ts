import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentAuthTime, sendSigningLink, signingWindowOpen } from './reauth';

const send = vi.hoisted(() => vi.fn());
vi.mock('firebase/auth', () => ({ sendSignInLinkToEmail: (...a: unknown[]) => send(...a) }));
vi.mock('../firebase/config', () => ({ auth: { name: 'auth' } }));

beforeEach(() => {
  send.mockReset();
  localStorage.clear();
});

describe('reauth', () => {
  it('keeps the window open under 14 minutes', () => {
    expect(signingWindowOpen(1000, 1000_000 + 13 * 60_000)).toBe(true);
    expect(signingWindowOpen(1000, 1000_000 + 14 * 60_000)).toBe(false);
    expect(signingWindowOpen(NaN, 1000_000)).toBe(false);
  });
  it('sends the link to /finish-sign-in with the nonce and remembers only the email', async () => {
    send.mockResolvedValue(undefined);
    await sendSigningLink('a@b.c', '0123456789abcdef0123456789abcdef');
    expect(send).toHaveBeenCalledWith(
      { name: 'auth' },
      'a@b.c',
      expect.objectContaining({ handleCodeInApp: true, url: `${window.location.origin}/finish-sign-in?sign=0123456789abcdef0123456789abcdef` }),
    );
    // No return path: an ordinary sign-in later must never land on /sign/complete.
    expect(localStorage.getItem('vcb.auth.returnTo')).toBeNull();
    expect(localStorage.getItem('emailForSignIn')).toBe('a@b.c');
  });
  it('does not remember anything when sending fails', async () => {
    send.mockRejectedValue(new Error('x'));
    await expect(sendSigningLink('a@b.c', '0123456789abcdef0123456789abcdef')).rejects.toThrow();
    expect(localStorage.getItem('emailForSignIn')).toBeNull();
  });
  it('reads auth_time from a refreshed token as a number', async () => {
    const getIdTokenResult = vi.fn().mockResolvedValue({ claims: { auth_time: '1234' } });
    expect(await currentAuthTime({ getIdTokenResult } as never)).toBe(1234);
    expect(getIdTokenResult).toHaveBeenCalledWith(true);
  });
});
