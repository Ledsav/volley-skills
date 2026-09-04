const EMAIL_STORAGE_KEY = 'emailForSignIn';

export function saveEmailForSignIn(email: string): void {
  window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
}

export function takeEmailForSignIn(): string | null {
  const email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
  window.localStorage.removeItem(EMAIL_STORAGE_KEY);
  return email;
}
