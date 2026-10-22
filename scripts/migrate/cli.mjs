// Shared by the migration and ops CLIs: flags, typed confirmation, and the two
// Firestore targets (production via the gitignored service-account key, or the
// local emulator). Never imported by tests.
import { existsSync, readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const KEY_PATH = 'serviceAccountKey.json';
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

function serviceAccount() {
  if (!existsSync(KEY_PATH)) fail(`Missing ${KEY_PATH} (gitignored service-account key). See scripts/seed/README.md.`);
  return JSON.parse(readFileSync(KEY_PATH, 'utf8'));
}

/** Production Firestore. Call refuseEmulatorHost() first. */
export function prodDb() {
  const key = serviceAccount();
  const app = initializeApp({ credential: cert(key), projectId: key.project_id }, 'prod');
  console.log(`PROD project "${key.project_id}"`);
  return getFirestore(app);
}

/**
 * The local emulator as a second app, pinned by host (not by FIRESTORE_EMULATOR_HOST,
 * which would also redirect the production app). The emulator ignores the credential.
 */
export function emulatorDb({ withKey = false } = {}) {
  if (!withKey) {
    // Emulator-only run (no production app in this process): the env var is the plain way.
    process.env.FIRESTORE_EMULATOR_HOST ||= EMULATOR_HOST;
    console.log(`EMULATOR at ${process.env.FIRESTORE_EMULATOR_HOST} (project "${PROJECT_ID}")`);
    return getFirestore(initializeApp({ projectId: PROJECT_ID }, 'emulator'));
  }
  const db = getFirestore(initializeApp({ credential: cert(serviceAccount()), projectId: PROJECT_ID }, 'emulator'));
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

/** Resolves only when the person types `expected` exactly; anything else exits. */
export async function confirmTyped(question, expected) {
  process.stdout.write(`${question}\nType "${expected}" to continue: `);
  const answer = await new Promise((resolve) => {
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (d) => {
      process.stdin.pause();
      resolve(String(d).trim());
    });
  });
  if (answer !== expected) fail('Not confirmed. Nothing was written.');
}
