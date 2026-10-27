import { sendSignInLinkToEmail, type User } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getLocale } from '../i18n/I18nProvider';
import { saveEmailForSignIn } from './emailLinkStorage';

/** One minute short of the rules' 15-minute freshness window. */
export const SIGNING_WINDOW_MS = 14 * 60 * 1000;

/**
 * Sends a fresh sign-in link to /finish-sign-in?sign=<nonce>, which goes on to /sign/complete.
 * The nonce ties the commit to this link: no return path is stored, so an ordinary sign-in
 * later never lands on /sign/complete.
 */
export async function sendSigningLink(email: string, nonce: string): Promise<void> {
  auth.languageCode = getLocale();
  await sendSignInLinkToEmail(auth, email, {
    url: `${window.location.origin}/finish-sign-in?sign=${encodeURIComponent(nonce)}`,
    handleCodeInApp: true,
  });
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
