import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

const useEmulator = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true';

// App Check (reCAPTCHA v3) rejects Firestore/Auth traffic that does not come
// from this app, which is the practical defence against someone hitting the
// project directly with the public web API key. Skipped without a site key and
// against the emulator, so dev, tests, and CI need no extra setup. See
// docs/superpowers/runbooks/2026-09-09-quota-protection-setup.md.
const appCheckKey = import.meta.env.VITE_APPCHECK_RECAPTCHA_KEY;
if (appCheckKey && !useEmulator) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);

// Local development against the Firestore + Auth emulators: run `npm run emulator`,
// then start the app with VITE_USE_EMULATOR=true (e.g. in .env.local). Never active
// in a production build.
if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
