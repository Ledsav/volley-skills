// The service-account key every production script uses (backup design §7). It is kept
// encrypted (serviceAccountKey.json.enc, made by `npm run key:encrypt`) and opened with a
// passphrase once per run. A plain serviceAccountKey.json still works, with a warning.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openSecret } from '../ops/backupCrypto.mjs';
import { askSecret } from './prompt.mjs';

export const ENC_KEY_PATH = 'serviceAccountKey.json.enc';
export const PLAIN_KEY_PATH = 'serviceAccountKey.json';

const opened = new Map();

/** The parsed key from `dir` (default: the repo root you run the scripts from). */
export async function loadServiceAccount({ dir = '.', ask = askSecret, warn = console.warn } = {}) {
  const at = resolve(dir);
  if (opened.has(at)) return opened.get(at);
  const enc = join(at, ENC_KEY_PATH);
  const plain = join(at, PLAIN_KEY_PATH);
  let key;
  if (existsSync(enc)) {
    const passphrase = await ask('Passphrase for the service-account key: ');
    try {
      key = JSON.parse(openSecret(JSON.parse(readFileSync(enc, 'utf8')), passphrase).toString('utf8'));
    } catch {
      throw new Error(`Wrong passphrase, or ${ENC_KEY_PATH} was changed.`);
    }
  } else if (existsSync(plain)) {
    warn(`Warning: ${PLAIN_KEY_PATH} is not encrypted. Run npm run key:encrypt (scripts/ops/README.md).`);
    key = JSON.parse(readFileSync(plain, 'utf8'));
  } else {
    throw new Error(`Missing ${ENC_KEY_PATH} (or a plain ${PLAIN_KEY_PATH}) at the repo root. See scripts/ops/README.md.`);
  }
  opened.set(at, key);
  return key;
}
