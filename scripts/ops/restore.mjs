#!/usr/bin/env node
// Opens a backup and restores it (backup design §4).
//
//   npm run backup:restore -- --file <f> --key <private key> --check   # open it, print counts, write nothing
//   npm run backup:restore -- --file <f> --key <private key>           # restore into the local emulator
//   npm run backup:restore -- --file <f> --key <private key> --prod    # restore into PRODUCTION
//     [--from <n>]         continue a stopped restore at document n (it prints the number)
//     [--max-writes <n>]   production only: stop after n writes (default 15,000 of Spark's
//                          20,000 a day); continue the next day with the --from it prints
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
import { safeMessage } from './opsPaths.mjs';

const argv = process.argv.slice(2);
const file = flag(argv, '--file');
const keyFile = flag(argv, '--key');
const check = argv.includes('--check');
const prod = argv.includes('--prod');
if (!file || !keyFile) fail('Missing --file <backup> or --key <private key file>.');
for (const f of [file, keyFile]) if (!existsSync(f)) fail(`${f} does not exist.`);
if (check && prod) fail('--check writes nothing; drop --prod.');
const from = Number(flag(argv, '--from') ?? 0);
const maxWrites = Number(flag(argv, '--max-writes') ?? (prod ? 15000 : Infinity));
if (!Number.isInteger(from) || from < 0) fail('--from must be a whole number of 0 or more.');
if (!(maxWrites >= 1)) fail('--max-writes must be a positive number.');

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

if (from >= docs.length) fail(`--from ${from} is past the last document (${docs.length}).`);
const until = Math.min(docs.length, from + maxWrites);
if (prod) {
  await confirmTyped(`This writes documents ${from} to ${until - 1} (of ${docs.length}) to PRODUCTION, replacing the ones with the same path.`, PROJECT_ID);
}
try {
  const { written, nextFrom } = await restoreDocs(db, docs, { from, until, log: console.log });
  console.log(`Restored ${written} documents${prod ? ' to PRODUCTION' : ' to the emulator'}.`);
  if (nextFrom < docs.length) console.log(`Not finished: continue (the next day, for the write quota) with --from ${nextFrom}.`);
  process.exit(0);
} catch (e) {
  fail(`${safeMessage(e)}
Stopped. Continue with --from ${e.nextFrom ?? from} once the cause is fixed (for the daily write quota: the next day).`);
}
