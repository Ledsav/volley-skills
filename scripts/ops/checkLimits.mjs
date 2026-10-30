#!/usr/bin/env node
// Read-only check of stored documents against the size caps (src/types/limitValues.js, mirrored
// by firestore.rules). Run it before deploying the caps: a doc over a cap would refuse every later
// save of that doc.
//
//   node scripts/ops/checkLimits.mjs --prod [--max-reads 20000] [--club <id>]   # production (asks for the key passphrase)
//   node scripts/ops/checkLimits.mjs --emulator [--club <id>]                     # the local emulator
//
// Reads every capped club document once (teams, players, physical tests, calendar, matches,
// awards, scouting usage, exercises, trainings, guides, section access); never match events,
// members or club profiles. Writes nothing. Prints only check names, caps, counts, maxima, doc
// paths and club ids, never a field value. Exit code 0: everything within the caps; 1: a field is
// over a cap, or the run failed (the message says which).
import { formatReport, limitsReport } from './limitsReport.mjs';
import { readForLimits } from './limitsRead.mjs';
import { safeMessage } from './opsPaths.mjs';
import { emulatorDb, fail, flag, prodDb, refuseEmulatorHost } from '../migrate/cli.mjs';

const argv = process.argv.slice(2);
const prod = argv.includes('--prod');
if (prod === argv.includes('--emulator')) fail('Pass exactly one of --prod or --emulator.');
const maxReads = Number(flag(argv, '--max-reads') ?? 20000);
if (!Number.isInteger(maxReads) || maxReads < 1) fail('--max-reads must be a positive whole number.');
const club = flag(argv, '--club');

if (prod) refuseEmulatorHost();
const db = prod ? await prodDb() : await emulatorDb();

try {
  console.log('Reading the capped documents (read only)...');
  const { docs, reads, clubs } = await readForLimits(db, { maxReads, clubIds: club ? [club] : null });
  console.log(`Read ${docs.length} documents in ${clubs} club(s), about ${reads} reads.`);
  const report = limitsReport(docs);
  for (const line of formatReport(report)) console.log(line);
  process.exit(report.over === 0 ? 0 : 1);
} catch (e) {
  fail(safeMessage(e));
}
