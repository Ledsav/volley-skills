#!/usr/bin/env node
// Exports the PRODUCTION teams' player docs (teams/*/players/*, no
// subcollections) to a local JSON file, for importPlayers.mjs.
//
//   npm run seed:export-prod-players            # needs the service-account key (scripts/ops/README.md)
//   node scripts/seed/exportProdPlayers.mjs --team <prodTeamId>
//
// READ-ONLY on prod: only get() — never a write.
// Output: reference/prod-players.json (gitignored). It holds minors' personal
// data — keep it local, never commit or copy it elsewhere, delete it when done.
// Console output is player counts per team id only — never field values.
//
// FIRESTORE_EMULATOR_HOST would silently redirect this process to the emulator,
// so the script refuses to run when it is set (and clears it defensively).

if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST is set. Unset it — this script reads PRODUCTION.');
  process.exit(1);
}
delete process.env.FIRESTORE_EMULATOR_HOST;

import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { loadServiceAccount } from '../lib/serviceAccount.mjs';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const OUT = 'reference/prod-players.json';
const PAGE = 500;
const MAX_DOCS = 5000;

// Make sure the export can never be committed by accident.
try {
  execFileSync('git', ['check-ignore', '-q', OUT]);
} catch {
  console.error(`Refusing to run: ${OUT} is not gitignored.`);
  process.exit(1);
}

const key = await loadServiceAccount();
admin.initializeApp({ credential: admin.credential.cert(key), projectId: key.project_id });
const db = admin.firestore();
const { Timestamp, DocumentReference, FieldPath } = admin.firestore;

// Tag non-JSON Firestore values so importPlayers.mjs can restore them.
function encode(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Timestamp) return { __ts: v.toMillis() };
  if (v instanceof DocumentReference) return { __ref: v.path };
  if (Array.isArray(v)) return v.map(encode);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]));
}

// Reads top-level `teams` (pre-migration layout) unless --club <id> is given; after the
// club platform migration (scripts/migrate/README.md) always pass --club <id>.
const clubIdx = process.argv.indexOf('--club');
const teamsCol = clubIdx > -1 ? db.collection('clubs').doc(process.argv[clubIdx + 1]).collection('teams') : db.collection('teams');
const teamArg = process.argv.indexOf('--team');
const teamIds =
  teamArg > -1 ? [process.argv[teamArg + 1]] : (await teamsCol.limit(100).get()).docs.map((d) => d.id);

const teams = {};
let total = 0;
for (const teamId of teamIds) {
  const coll = teamsCol.doc(teamId).collection('players');
  const players = [];
  let last = null;
  for (;;) {
    let q = coll.orderBy(FieldPath.documentId()).limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    for (const d of snap.docs) players.push({ id: d.id, data: encode(d.data()) });
    total += snap.size;
    if (total > MAX_DOCS) {
      console.error(`Aborting: more than ${MAX_DOCS} players. Nothing was written.`);
      process.exit(1);
    }
    if (snap.size < PAGE) break;
    last = snap.docs[snap.docs.length - 1];
  }
  teams[teamId] = players;
}

mkdirSync('reference', { recursive: true });
writeFileSync(OUT, JSON.stringify({ projectId: key.project_id, exportedAt: new Date().toISOString(), teams }));
console.log(`Wrote ${total} players to ${OUT} (local only — minors' data; delete when done).`);
for (const [id, players] of Object.entries(teams)) console.log(`  teams/${id}/players: ${players.length}`);
process.exit(0);
