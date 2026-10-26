#!/usr/bin/env node
// Dumps every player's current skill scores to scripts/seed/skillsSnapshot.json,
// keyed by fullName, so the seeder can reproduce the live roster's scores on a
// fresh database (doc IDs differ between environments; fullName is the join key).
//
//   node scripts/seed/snapshotSkills.mjs [--prod | --emulator] [--out <path>]
//
// The `block` skill is new: if a player has no block score yet it is written as
// BLOCK_DEFAULT (5) so seed + backfill share one source of truth.
// Logs counts only — never names or scores.

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { SKILL_KEYS } from './parseWorkbook.mjs';

import { assertProdClub, parseClubArg } from './clubArg.mjs';
import { loadServiceAccount } from '../lib/serviceAccount.mjs';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const PROJECT_ID = 'volley-skills';
const OUT_DEFAULT = 'scripts/seed/skillsSnapshot.json';
const BLOCK_DEFAULT = 5;

function parseArgs(argv) {
  const args = { target: 'emulator', out: OUT_DEFAULT, club: parseClubArg(argv) };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prod') args.target = 'prod';
    else if (a === '--emulator') args.target = 'emulator';
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--club') i++;
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    assertProdClub(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  if (args.target === 'prod') {
    const key = await loadServiceAccount();
    admin.initializeApp({ credential: admin.credential.cert(key), projectId: key.project_id });
    console.log(`Target: PROD project "${key.project_id}"`);
  } else {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    admin.initializeApp({ projectId: PROJECT_ID });
    console.log(`Target: EMULATOR at ${process.env.FIRESTORE_EMULATOR_HOST}`);
  }

  const db = admin.firestore();
  // collectionGroup spans every club: keep only this club's docs.
  const snap = (await db.collectionGroup('players').get()).docs.filter((d) => d.ref.path.startsWith(`clubs/${args.club}/`));

  if (snap.length === 0) {
    console.error(`No players found under clubs/${args.club}/ — wrong --club? ${args.out} was not written.`);
    process.exit(1);
  }

  const out = {};
  let dupes = 0;
  snap.forEach((doc) => {
    const data = doc.data();
    const name = data.fullName;
    if (!name) return;
    if (out[name]) dupes += 1;
    const skills = data.skills ?? {};
    const scores = {};
    for (const k of SKILL_KEYS) {
      const raw = skills[k]?.score;
      scores[k] = raw === undefined || raw === null ? (k === 'block' ? BLOCK_DEFAULT : null) : raw;
    }
    out[name] = scores;
  });

  if (Object.keys(out).length === 0) {
    console.error(`No player under clubs/${args.club}/ has a fullName — nothing to snapshot. ${args.out} was not written.`);
    process.exit(1);
  }

  const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
  writeFileSync(args.out, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(sorted).length} players to ${args.out}${dupes ? ` (${dupes} duplicate name(s) collapsed)` : ''}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
