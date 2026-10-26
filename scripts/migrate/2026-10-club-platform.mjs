#!/usr/bin/env node
// One-off: move the single-club production data under clubs/{clubId} (club platform
// spec §9). Runbook: scripts/migrate/README.md.
//
//   node scripts/migrate/2026-10-club-platform.mjs (--rehearse | --prod) \
//     --club <id> --owner <email> --operator <email> --country <XX> \
//     [--name <club name>] [--locale en|it] [--dry-run] [--resume]
//
//   --rehearse   read PRODUCTION (read-only), write the migrated tree to the local
//                emulator at 127.0.0.1:8080 (start it with `npm run emulator`).
//   --prod       read and write PRODUCTION; asks you to type the club id first.
//   --owner      the club admin who will accept the Terms and DPA (may be the operator).
//   --operator   the platform operator's email (gets platformAdmins/<email>).
//   --name       club name; default: the most common team.club.
//   --dry-run    read and plan only: prints the counts, estimated writes and reads.
//   --resume     continue a stopped run: docs that already exist are skipped.
//
// Both modes need the service-account key (serviceAccountKey.json.enc, see
// scripts/ops/README.md) and refuse to run while
// FIRESTORE_EMULATOR_HOST is set. The old top-level collections are left in place
// (grace period); scripts/migrate/dropLegacy.mjs removes them later.
//
// Spark quota: 50,000 reads and 20,000 writes a day, shared with the live app. Each
// pass (dry run, rehearsal, prod) costs about one read per legacy doc; the dry run
// prints the figure. If a run stops on quota, re-run the next day with --resume, and
// do not use the app in between (a doc changed after it was copied is not copied again).
//
// Logs ids and counts only — never player or guardian field values.

import { assertReachable, confirmTyped, emulatorDb, fail, flag, prodDb, refuseEmulatorHost } from './cli.mjs';
import { runMigration } from './clubPlatformRun.mjs';

const argv = process.argv.slice(2);
const rehearse = argv.includes('--rehearse');
const prod = argv.includes('--prod');
if (rehearse === prod) fail('Pass exactly one of --rehearse or --prod.');

const options = {
  clubId: flag(argv, '--club'),
  owner: flag(argv, '--owner'),
  operator: flag(argv, '--operator'),
  country: flag(argv, '--country'),
  name: flag(argv, '--name'),
  locale: flag(argv, '--locale') ?? 'en',
};
for (const required of ['clubId', 'owner', 'operator', 'country']) {
  if (!options[required]) fail(`Missing --${required === 'clubId' ? 'club' : required}.`);
}
const dryRun = argv.includes('--dry-run');
const resume = argv.includes('--resume');

refuseEmulatorHost();
const source = await prodDb();
// A dry run reads production only, so a rehearsal dry run needs no emulator.
const target = rehearse ? (dryRun ? null : await emulatorDb({ withKey: true })) : source;
if (rehearse && target) await assertReachable(target);
if (prod && !dryRun) {
  await confirmTyped(`This writes clubs/${options.clubId} and its data to PRODUCTION.`, options.clubId);
}

try {
  const result = await runMigration({ source, target, options, resume, dryRun });
  process.exit(result.ok ? 0 : 1);
} catch (e) {
  fail(e.message);
}
