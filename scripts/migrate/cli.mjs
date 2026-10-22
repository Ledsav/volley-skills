// Shared by the migration and ops CLIs: flags, typed confirmation, and the two
// Firestore targets (production via the encrypted service-account key, or the
// local emulator). Never imported by tests.
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { loadServiceAccount } from '../lib/serviceAccount.mjs';

export { confirmTyped } from '../lib/prompt.mjs';

export const EMULATOR_HOST = '127.0.0.1:8080';
export const PROJECT_ID = 'volley-skills';

export function fail(message) {
  console.error(message);
  process.exit(1);
}

/** The value after `--name`, or undefined; exits when the flag has no value. */
export function flag(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) fail(`${name} needs a value.`);
  return v;
}

/** A script that reads production must not be silently redirected to an emulator. */
export function refuseEmulatorHost() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    fail('Refusing to run: FIRESTORE_EMULATOR_HOST is set. Unset it — this run reads PRODUCTION.');
  }
}

async function serviceAccount() {
  try {
    return await loadServiceAccount();
  } catch (e) {
    return fail(e.message);
  }
}

/** Production Firestore (asks for the key's passphrase). Call refuseEmulatorHost() first. */
export async function prodDb() {
  const key = await serviceAccount();
  const app = initializeApp({ credential: cert(key), projectId: key.project_id }, 'prod');
  console.log(`PROD project "${key.project_id}"`);
  return getFirestore(app);
}

/**
 * The local emulator as a second app, pinned by host (not by FIRESTORE_EMULATOR_HOST,
 * which would also redirect the production app). The emulator ignores the credential.
 */
export async function emulatorDb({ withKey = false } = {}) {
  if (!withKey) {
    // Emulator-only run (no production app in this process): the env var is the plain way.
    process.env.FIRESTORE_EMULATOR_HOST ||= EMULATOR_HOST;
    console.log(`EMULATOR at ${process.env.FIRESTORE_EMULATOR_HOST} (project "${PROJECT_ID}")`);
    return getFirestore(initializeApp({ projectId: PROJECT_ID }, 'emulator'));
  }
  const db = getFirestore(initializeApp({ credential: cert(await serviceAccount()), projectId: PROJECT_ID }, 'emulator'));
  db.settings({ host: EMULATOR_HOST, ssl: false });
  console.log(`EMULATOR at ${EMULATOR_HOST} (project "${PROJECT_ID}")`);
  return db;
}

/** Fails fast when nothing answers at the emulator host. */
export async function assertReachable(db) {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
  try {
    await Promise.race([db.listCollections(), timeout]);
  } catch {
    fail(`No Firestore emulator answers at ${EMULATOR_HOST}: start it with npm run emulator.`);
  }
}
