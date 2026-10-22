#!/usr/bin/env node
// Opens a backup and restores it (backup design §4).
//
//   npm run backup:restore -- --file <f> --key <private key> --check   # open it, print counts, write nothing
//   npm run backup:restore -- --file <f> --key <private key>           # restore into the local emulator
//   npm run backup:restore -- --file <f> --key <private key> --prod    # restore into PRODUCTION
//
// Asks for the private key's passphrase. A restore writes every backed-up document with
// `set` (one write each); documents created after the backup are left in place. --prod
// accepts only a production backup and asks you to type the project id first.
import { existsSync, readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { countsByCollection, restoreDocs, unpackBackup } from './backupCore.mjs';
import { assertReachable, confirmTyped, emulatorDb, fail, flag, PROJECT_ID, prodDb, refuseEmulatorHost } from '../migrate/cli.mjs';
import { askSecret } from '../lib/prompt.mjs';

const argv = process.argv.slice(2);
const file = flag(argv, '--file');
const keyFile = flag(argv, '--key');
const check = argv.includes('--check');
const prod = argv.includes('--prod');
if (!file || !keyFile) fail('Missing --file <backup> or --key <private key file>.');
for (const f of [file, keyFile]) if (!existsSync(f)) fail(`${f} does not exist.`);
if (check && prod) fail('--check writes nothing; drop --prod.');

let envelope;
try {
  envelope = JSON.parse(readFileSync(file, 'utf8'));
} catch {
  fail(`${file} is not a backup file.`);
}
console.log(`Backup of "${envelope.projectId}" taken ${envelope.createdAt} (key ${String(envelope.keyId).slice(0, 12)}...).`);
if (prod && envelope.projectId !== PROJECT_ID) fail(`Refusing: this is a backup of "${envelope.projectId}", not of production.`);

const passphrase = await askSecret('Passphrase for the backup private key: ');
const privateKeyPem = readFileSync(keyFile, 'utf8');

// References are rebuilt on the Firestore they will be written to; --check builds them on
// an offline instance that never connects.
let db;
if (check) db = getFirestore(initializeApp({ projectId: PROJECT_ID }, 'offline'));
else if (prod) {
  refuseEmulatorHost();
  db = await prodDb();
} else {
  db = await emulatorDb();
  await assertReachable(db);
}

let docs;
try {
  ({ docs } = unpackBackup(envelope, privateKeyPem, passphrase, db));
} catch {
  fail('Cannot open the backup: wrong private key or passphrase, or the file was changed. Nothing was written.');
}
console.log('Documents per top-level collection:');
for (const [col, n] of Object.entries(countsByCollection(docs))) console.log(`  ${col}: ${n}`);
console.log(`Total: ${docs.length} documents.`);
if (check) {
  console.log('The backup opens. Nothing was written.');
  process.exit(0);
}

if (prod) await confirmTyped(`This writes ${docs.length} documents to PRODUCTION, replacing the ones with the same path.`, PROJECT_ID);
try {
  const { written } = await restoreDocs(db, docs, { log: console.log });
  console.log(`Restored ${written} documents${prod ? ' to PRODUCTION' : ' to the emulator'}.`);
  process.exit(0);
} catch (e) {
  fail(e.message);
}
