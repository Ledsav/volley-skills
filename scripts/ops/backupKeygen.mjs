#!/usr/bin/env node
// Creates the backup key pair, once (backup design §3.3).
//
//   npm run backup:keygen -- --out <folder outside the repo>
//
// Writes the public key to scripts/ops/backup-public-key.pem (commit it: backups are
// sealed with it) and the private key, encrypted with the passphrase you choose, to
// <folder>/volley-skills-backup-private-key.pem. Keep the private key and its
// passphrase in your password manager, plus an offline copy: without them no backup
// can ever be opened. Refuses to replace an existing key pair.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateBackupKeys, keyFingerprint } from './backupCrypto.mjs';
import { PUBLIC_KEY_PATH, requireFolderOutsideRepo } from './opsPaths.mjs';
import { fail, flag } from '../migrate/cli.mjs';
import { askNewSecret } from '../lib/prompt.mjs';

const out = requireFolderOutsideRepo(flag(process.argv.slice(2), '--out'));
if (existsSync(PUBLIC_KEY_PATH)) {
  fail(`${PUBLIC_KEY_PATH} already exists. Backups made with it need its private key; delete it yourself only if you mean to start over.`);
}
const privatePath = join(out, 'volley-skills-backup-private-key.pem');
if (existsSync(privatePath)) fail(`${privatePath} already exists.`);

try {
  const passphrase = await askNewSecret('New passphrase for the backup private key (at least 12 characters): ');
  console.log('Generating an RSA-4096 key pair (a few seconds)...');
  const { publicKeyPem, privateKeyPem } = generateBackupKeys(passphrase);
  writeFileSync(privatePath, privateKeyPem, { flag: 'wx', mode: 0o600 });
  writeFileSync(PUBLIC_KEY_PATH, publicKeyPem, { flag: 'wx' });
  console.log(`Private key: ${privatePath}`);
  console.log(`Public key:  ${PUBLIC_KEY_PATH} (commit it)`);
  console.log(`Key id:      ${keyFingerprint(publicKeyPem)}`);
  console.log('Now store the private key file and its passphrase in your password manager, and keep an offline copy.');
  process.exit(0);
} catch (e) {
  fail(e.message);
}
