#!/usr/bin/env node
// Replaces the seeded emulator team's players with the prod players exported by
// exportProdPlayers.mjs. Everything else in the emulator (team doc, access,
// guides, library, …) is left alone.
//
//   npm run seed:import-players                       # against a running emulator (127.0.0.1:8080)
//   node scripts/seed/importPlayers.mjs --from <prodTeamId>   # needed if several prod teams have players
//
// Emulator-only. Keeps prod player doc ids + fields, but overwrites the
// denormalized teamName/ageGroup/season with the seeded team's values and
// clears viewerEmails. Prints counts only.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST is not a local address.');
  process.exit(1);
}

const FILE = 'reference/prod-players.json';
if (!existsSync(FILE)) {
  console.error(`${FILE} not found — run \`npm run seed:export-prod-players\` first.`);
  process.exit(1);
}
const { teams: exported } = JSON.parse(readFileSync(FILE, 'utf8'));

const fromArg = process.argv.indexOf('--from');
const withPlayers = Object.keys(exported).filter((id) => exported[id].length);
const sourceId = fromArg > -1 ? process.argv[fromArg + 1] : withPlayers.length === 1 ? withPlayers[0] : null;
if (!sourceId || !exported[sourceId]) {
  console.error('Pick the prod team with --from <teamId>. Teams in the export:');
  for (const id of Object.keys(exported)) console.error(`  ${id}: ${exported[id].length} players`);
  process.exit(1);
}

admin.initializeApp({ projectId: 'volley-skills' });
const db = admin.firestore();
const { Timestamp } = admin.firestore;

function decode(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(decode);
  const keys = Object.keys(v);
  if (keys.length === 1 && keys[0] === '__ts') return Timestamp.fromMillis(v.__ts);
  if (keys.length === 1 && keys[0] === '__ref') return db.doc(v.__ref);
  return Object.fromEntries(keys.map((k) => [k, decode(v[k])]));
}

const teams = await db.collection('teams').where('createdBy', '==', 'seed-script').limit(1).get();
if (teams.empty) {
  console.error('No seeded team found — run `npm run seed:emulator` first.');
  process.exit(1);
}
const teamRef = teams.docs[0].ref;
const team = teams.docs[0].data();

// Remove the current players (and anything under them).
const old = await teamRef.collection('players').limit(500).get();
for (const d of old.docs) await db.recursiveDelete(d.ref);

const players = exported[sourceId];
for (let i = 0; i < players.length; i += 400) {
  const batch = db.batch();
  for (const { id, data } of players.slice(i, i + 400)) {
    batch.set(teamRef.collection('players').doc(id), {
      ...decode(data),
      teamName: team.name,
      ageGroup: team.ageGroup,
      season: team.season,
      viewerEmails: [],
    });
  }
  await batch.commit();
}
console.log(`Team ${teamRef.id}: removed ${old.size} players, imported ${players.length} from prod team ${sourceId}.`);
process.exit(0);
