#!/usr/bin/env node
// Encrypts the service-account key at rest (backup design §7).
//
//   npm run key:encrypt
//
// Reads ./serviceAccountKey.json, asks for a passphrase twice (at least 12 characters),
// writes ./serviceAccountKey.json.enc, opens it again to check, then deletes the plain
// file. Every production script then asks for the passphrase. Afterwards rotate the key
// once in the Google Cloud console (scripts/ops/README.md) so old plain copies stop working.
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { openSecret, sealSecret } from './backupCrypto.mjs';
import { fail } from '../migrate/cli.mjs';
import { askNewSecret } from '../lib/prompt.mjs';
import { ENC_KEY_PATH, PLAIN_KEY_PATH } from '../lib/serviceAccount.mjs';

if (existsSync(ENC_KEY_PATH)) fail(`${ENC_KEY_PATH} already exists. Delete it first to encrypt a new key.`);
if (!existsSync(PLAIN_KEY_PATH)) fail(`Missing ${PLAIN_KEY_PATH} at the repo root.`);

try {
  const plain = readFileSync(PLAIN_KEY_PATH);
  JSON.parse(plain.toString('utf8'));
  const passphrase = await askNewSecret('New passphrase for the service-account key (at least 12 characters): ');
  writeFileSync(ENC_KEY_PATH, JSON.stringify(sealSecret(plain, passphrase)), { flag: 'wx', mode: 0o600 });
  if (!openSecret(JSON.parse(readFileSync(ENC_KEY_PATH, 'utf8')), passphrase).equals(plain)) {
    unlinkSync(ENC_KEY_PATH);
    fail('The encrypted key did not open back to the same content. Nothing was deleted.');
  }
  unlinkSync(PLAIN_KEY_PATH);
  console.log(`Wrote ${ENC_KEY_PATH} and deleted ${PLAIN_KEY_PATH}.`);
  console.log('Next: rotate the key in the Google Cloud console (scripts/ops/README.md).');
  process.exit(0);
} catch (e) {
  fail(e.message);
}
