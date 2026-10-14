const KEY = 'vcb.auth.returnTo';

/** Same-origin app paths only: no protocol, no protocol-relative `//`, no backslash tricks. */
export function isSafeReturnPath(p: string): boolean {
  return /^\/(?![/\\])/.test(p) && !/[\\]/.test(p) && !p.startsWith('/login') && !p.startsWith('/finish-sign-in');
}

/** localStorage, not sessionStorage: the email link may open in a new tab. */
export function rememberReturnTo(path: string): void {
  if (!isSafeReturnPath(path)) return;
  try {
    localStorage.setItem(KEY, path);
  } catch {
    /* storage blocked: fall back to home */
  }
}

export function takeReturnTo(): string {
  try {
    const value = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return value && isSafeReturnPath(value) ? value : '/';
  } catch {
    return '/';
  }
}
