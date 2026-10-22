#!/usr/bin/env node
// Purge an ended club down to a tombstone (club platform spec §7.4).
//
//   node scripts/ops/purgeClub.mjs --club <id> [--emulator | --prod]
//
// Runs only for a club that is `deleted` (rejected while pending) or `terminating`
// with its retrieval window (retrievalEndsAt) over. Deletes every subcollection —
// members, teams and everything under them, library, config, sectionAccess — except
// acceptances and statusLog, then reduces clubs/<id> to { name, country, ownerEmail,
// createdAt, status: 'deleted', statusChangedAt, legal } and logs "Data purged".
// Firebase Auth accounts are not touched. Asks you to type the club id first.
// Prints counts only; keep the summary for your records.

import { purgeAllowed, purgeClub } from './purge.mjs';
import { confirmTyped, emulatorDb, fail, flag, prodDb, refuseEmulatorHost } from '../migrate/cli.mjs';

const argv = process.argv.slice(2);
const prod = argv.includes('--prod');
const clubId = flag(argv, '--club');
if (!clubId) fail('Missing --club <id>.');

if (prod) refuseEmulatorHost();
const db = prod ? await prodDb() : await emulatorDb();

const club = (await db.doc(`clubs/${clubId}`).get()).data() ?? null;
const allowed = purgeAllowed(club, new Date());
if (!allowed.ok) fail(`Refusing: ${allowed.reason}.`);

await confirmTyped(`This permanently deletes the data of clubs/${clubId}${prod ? ' in PRODUCTION' : ''}.`, clubId);

try {
  const summary = await purgeClub(db, clubId, new Date());
  console.log(`Purged clubs/${clubId} on ${new Date().toISOString()}:`);
  for (const [sub, n] of Object.entries(summary)) console.log(`  ${sub}: ${n}`);
  process.exit(0);
} catch (e) {
  fail(e.message);
}
