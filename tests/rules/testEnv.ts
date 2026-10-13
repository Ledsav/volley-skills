import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

let testEnv: RulesTestEnvironment | null = null;

// `firebase emulators:exec` sets FIRESTORE_EMULATOR_HOST, so a run on another
// port (e.g. while a dev emulator holds 8080) still finds its emulator.
const [envHost, envPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? '').split(':');
const EMULATOR_HOST = envHost || '127.0.0.1';
const EMULATOR_PORT = Number(envPort) || 8080;

export async function getTestEnv(): Promise<RulesTestEnvironment> {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId: 'volley-skills-test',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: EMULATOR_HOST,
        port: EMULATOR_PORT,
      },
    });
  }
  return testEnv;
}
