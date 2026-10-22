#!/usr/bin/env node
// After the club-platform migration's grace period (14 days, spec §9.6): delete the
// old single-club top-level collections. Runbook: scripts/migrate/README.md.
//
//   node scripts/migrate/dropLegacy.mjs --club <id> [--emulator | --prod]
//
// Refuses until clubs/<id> exists and was created at least 14 days ago. Prints the
// doc count per collection, then asks you to type "delete legacy". Never touches
// users, interestSignups, platformAdmins or clubs. Logs counts only.
//
// Spark quota: 20,000 deletes a day. If it stops on quota, run it again the next
// day; it continues with whatever is left.

import { DROP_COLLECTIONS, dropAllowed, dropLegacy } from './legacy.mjs';
import { countUnder } from './firestoreTree.mjs';
import { confirmTyped, emulatorDb, fail, flag, prodDb, refuseEmulatorHost } from './cli.mjs';

const argv = process.argv.slice(2);
const prod = argv.includes('--prod');
const clubId = flag(argv, '--club');
if (!clubId) fail('Missing --club <id> (the migrated club).');

if (prod) refuseEmulatorHost();
const db = prod ? prodDb() : emulatorDb();

const club = (await db.doc(`clubs/${clubId}`).get()).data() ?? null;
const allowed = dropAllowed(club, new Date());
if (!allowed.ok) fail(`Refusing: ${allowed.reason}.`);

console.log('Legacy collections (docs at all depths):');
for (const name of DROP_COLLECTIONS) console.log(`  ${name}: ${await countUnder(db, name)}`);
await confirmTyped(`This deletes the collections above${prod ? ' from PRODUCTION' : ''}.`, 'delete legacy');

await dropLegacy(db);
console.log('Done.');
process.exit(0);
