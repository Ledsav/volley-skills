import { sendSignInLinkToEmail, type User } from 'firebase/auth';
import { auth } from '../firebase/config';
import { saveEmailForSignIn } from './emailLinkStorage';
import { rememberReturnTo } from './returnTo';

/** One minute short of the rules' 15-minute freshness window. */
export const SIGNING_WINDOW_MS = 14 * 60 * 1000;

/** Sends a fresh sign-in link that lands on /finish-sign-in and returns to /sign/complete. */
export async function sendSigningLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth, email, {
    url: `${window.location.origin}/finish-sign-in`,
    handleCodeInApp: true,
  });
  rememberReturnTo('/sign/complete');
  saveEmailForSignIn(email);
}

/** The token's `auth_time` in seconds, read from a freshly refreshed token. */
export async function currentAuthTime(user: User): Promise<number> {
  const result = await user.getIdTokenResult(true);
  return Number(result.claims.auth_time);
}

export function signingWindowOpen(authTimeSec: number, nowMs: number): boolean {
  return Number.isFinite(authTimeSec) && nowMs - authTimeSec * 1000 < SIGNING_WINDOW_MS;
}
