import { afterEach, describe, expect, it, vi } from 'vitest';

const mockInitializeApp = vi.fn(() => 'app-instance');
const mockGetAuth = vi.fn(() => 'auth-instance');
const mockGetFirestore = vi.fn(() => 'firestore-instance');
const mockConnectAuthEmulator = vi.fn();
const mockConnectFirestoreEmulator = vi.fn();
const mockInitializeAppCheck = vi.fn(() => 'appcheck-instance');
const mockReCaptchaV3Provider = vi.fn((key: string) => ({ provider: 'recaptcha-v3', key }));

vi.mock('firebase/app', () => ({ initializeApp: mockInitializeApp }));
vi.mock('firebase/auth', () => ({
  getAuth: mockGetAuth,
  connectAuthEmulator: mockConnectAuthEmulator,
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: mockGetFirestore,
  connectFirestoreEmulator: mockConnectFirestoreEmulator,
}));
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: mockInitializeAppCheck,
  ReCaptchaV3Provider: mockReCaptchaV3Provider,
}));

describe('firebase config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    mockConnectAuthEmulator.mockClear();
    mockConnectFirestoreEmulator.mockClear();
    mockInitializeAppCheck.mockClear();
    mockReCaptchaV3Provider.mockClear();
  });

  it('initializes the firebase app and exports auth/firestore instances', async () => {
    const { auth, db } = await import('./config');
    expect(mockInitializeApp).toHaveBeenCalled();
    expect(auth).toBe('auth-instance');
    expect(db).toBe('firestore-instance');
  });

  it('does not connect to the emulators by default', async () => {
    await import('./config');
    expect(mockConnectAuthEmulator).not.toHaveBeenCalled();
    expect(mockConnectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it('does not initialize App Check when no reCAPTCHA key is configured', async () => {
    await import('./config');
    expect(mockInitializeAppCheck).not.toHaveBeenCalled();
  });

  it('initializes App Check with reCAPTCHA v3 when a key is configured', async () => {
    vi.stubEnv('VITE_APPCHECK_RECAPTCHA_KEY', 'site-key-123');

    await import('./config');

    expect(mockReCaptchaV3Provider).toHaveBeenCalledWith('site-key-123');
    expect(mockInitializeAppCheck).toHaveBeenCalledWith('app-instance', {
      provider: { provider: 'recaptcha-v3', key: 'site-key-123' },
      isTokenAutoRefreshEnabled: true,
    });
  });

  it('does not initialize App Check when running against the emulator, even with a key', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_USE_EMULATOR', 'true');
    vi.stubEnv('VITE_APPCHECK_RECAPTCHA_KEY', 'site-key-123');

    await import('./config');

    expect(mockInitializeAppCheck).not.toHaveBeenCalled();
  });

  it('connects to the auth + firestore emulators when VITE_USE_EMULATOR is "true" in dev', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_USE_EMULATOR', 'true');

    await import('./config');

    expect(mockConnectAuthEmulator).toHaveBeenCalledWith('auth-instance', 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledWith('firestore-instance', '127.0.0.1', 8080);
  });
});
