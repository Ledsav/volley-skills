#!/usr/bin/env node
// Takes an encrypted backup of the whole database (backup design §3).
//
//   npm run backup -- --prod --out <folder>        # production (asks for the key passphrase)
//   npm run backup -- --emulator --out <folder>    # the local emulator
//
// Reads every document (about 3 reads each), seals them with scripts/ops/backup-public-key.pem,
// writes <folder>/volley-skills-<time>.vsbackup, reads it back, then deletes backups in
// <folder> older than 35 days (the DPA window). Prints counts, the file name, size and
// SHA-256 only. Run it weekly and before every risky change; copy the file to the
// external drive. Check it opens with `npm run backup:restore -- --check`.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { keyFingerprint } from './backupCrypto.mjs';
import { countsByCollection, packBackup, readEverything } from './backupCore.mjs';
import { backupFileName, backupsToPrune, RETENTION_DAYS } from './backupFiles.mjs';
import { PUBLIC_KEY_PATH, requireFolderOutsideRepo } from './opsPaths.mjs';
import { emulatorDb, fail, flag, PROJECT_ID, prodDb, refuseEmulatorHost } from '../migrate/cli.mjs';

const argv = process.argv.slice(2);
const prod = argv.includes('--prod');
if (prod === argv.includes('--emulator')) fail('Pass exactly one of --prod or --emulator.');
const out = requireFolderOutsideRepo(flag(argv, '--out'));
if (!existsSync(PUBLIC_KEY_PATH)) fail(`Missing ${PUBLIC_KEY_PATH}: run npm run backup:keygen first (scripts/ops/README.md).`);
const publicKeyPem = readFileSync(PUBLIC_KEY_PATH, 'utf8');

if (prod) refuseEmulatorHost();
const db = prod ? await prodDb() : await emulatorDb();
// Only a production backup can be restored to production (restore.mjs checks this).
const projectId = prod ? PROJECT_ID : `${PROJECT_ID}-emulator`;

try {
  const now = new Date();
  console.log('Reading every document...');
  const { docs, reads } = await readEverything(db);
  const envelope = packBackup(docs, { projectId, createdAt: now.toISOString(), publicKeyPem });
  const name = backupFileName(now);
  const file = join(out, name);
  const body = JSON.stringify(envelope);
  writeFileSync(file, body, { flag: 'wx' });

  const written = readFileSync(file, 'utf8');
  if (written !== body || JSON.parse(written).keyId !== keyFingerprint(publicKeyPem)) fail(`${name} did not read back intact.`);

  console.log('Documents per top-level collection:');
  for (const [col, n] of Object.entries(countsByCollection(docs))) console.log(`  ${col}: ${n}`);
  console.log(`Total: ${docs.length} documents, about ${reads} reads.`);
  console.log(`Wrote ${file} (${Buffer.byteLength(written)} bytes, SHA-256 ${createHash('sha256').update(written).digest('hex')}).`);

  const old = backupsToPrune(readdirSync(out), now).filter((n) => n !== name);
  for (const n of old) unlinkSync(join(out, n));
  if (old.length > 0) console.log(`Deleted ${old.length} backup(s) older than ${RETENTION_DAYS} days: ${old.join(', ')}`);
  process.exit(0);
} catch (e) {
  fail(e.message);
}
