#!/usr/bin/env node
// Backfill `searchTokens` on exercises and trainings (UI redesign plan 3, spec §6.1).
//
//   node scripts/migrate/2026-10-search-tokens.mjs (--club <id> | --all-clubs) (--emulator | --prod) [--dry-run]
//
// Reads each exercise and training once and writes only docs whose tokens are missing or
// differ, so a second run writes nothing. Prints counts only. See README.md.

import { backfillSearchTokens } from './searchTokensRun.mjs';
import { confirmTyped, emulatorDb, fail, flag, prodDb, refuseEmulatorHost } from './cli.mjs';

const argv = process.argv.slice(2);
const prod = argv.includes('--prod');
const emulator = argv.includes('--emulator');
const allClubs = argv.includes('--all-clubs');
const dryRun = argv.includes('--dry-run');
const clubArg = flag(argv, '--club');

if (prod === emulator) fail('Pass exactly one of --emulator or --prod.');
if (Boolean(clubArg) === allClubs) fail('Pass exactly one of --club <id> or --all-clubs.');

if (prod) refuseEmulatorHost();
const db = prod ? await prodDb() : await emulatorDb();

let clubIds;
if (allClubs) {
  const snap = await db.collection('clubs').get();
  clubIds = snap.docs.filter((d) => d.data().status !== 'deleted').map((d) => d.id);
} else {
  clubIds = [clubArg];
}

if (prod && !dryRun) {
  await confirmTyped(`This writes searchTokens on exercises and trainings of ${clubIds.length} club(s) in PRODUCTION.`, 'backfill search');
}

try {
  const total = { read: 0, written: 0, skipped: 0 };
  const verb = dryRun ? 'would write' : 'written';
  for (const id of clubIds) {
    const r = await backfillSearchTokens(db, id, { dryRun });
    console.log(`clubs/${id}: read ${r.read}, ${verb} ${r.written}, skipped ${r.skipped}`);
    for (const k of Object.keys(total)) total[k] += r[k];
  }
  console.log(`Total${dryRun ? ' (dry run, nothing written)' : ''}: read ${total.read}, ${verb} ${total.written}, skipped ${total.skipped}`);
  process.exit(0);
} catch (e) {
  fail(e.message);
}
