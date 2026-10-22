// An Admin SDK Firestore on the rules-test emulator (same project as testEnv.ts),
// for testing the scripts in scripts/migrate and scripts/ops. `firebase
// emulators:exec` sets FIRESTORE_EMULATOR_HOST, which the Admin SDK follows.
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const NAME = 'scripts-test';

export function adminDb() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set: run through emulators:exec');
  const app = getApps().find((a) => a.name === NAME) ?? initializeApp({ projectId: 'volley-skills-test' }, NAME);
  return getFirestore(app);
}

/** Writes `{ path: data }` docs. */
export async function put(db, docs) {
  for (const [path, data] of Object.entries(docs)) await db.doc(path).set(data);
}
