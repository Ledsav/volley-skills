#!/usr/bin/env node
// Deletes backups older than 28 days from a folder, e.g. the external drive (backup design §3.4).
//
//   npm run backup:prune -- --dir <folder>
//
// Only files named like a backup (volley-skills-<time>.vsbackup) are ever deleted, by the
// date in their name. `npm run backup` already prunes its own --out folder; run this on every
// other folder that holds copies, in the weekly routine, so no copy outlives the DPA's 35 days.
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { backupsToPrune, RETENTION_DAYS } from './backupFiles.mjs';
import { fail, flag } from '../migrate/cli.mjs';

const dir = flag(process.argv.slice(2), '--dir');
if (!dir) fail('Missing --dir <folder>.');
if (!existsSync(dir)) fail(`${dir} does not exist.`);

const old = backupsToPrune(readdirSync(dir), new Date());
for (const name of old) unlinkSync(join(dir, name));
console.log(old.length > 0 ? `Deleted ${old.length} backup(s) older than ${RETENTION_DAYS} days: ${old.join(', ')}` : `No backups older than ${RETENTION_DAYS} days in ${dir}.`);
