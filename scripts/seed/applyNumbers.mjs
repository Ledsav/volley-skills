#!/usr/bin/env node
// Applies unique jersey numbers (and a libero) to the seeded players in the
// LOCAL Firestore emulator, from the gitignored reference/jersey-numbers.json.
//
//   npm run seed:numbers            # against a running emulator (127.0.0.1:8080)
//
// Emulator-only. Updates only `number` / `positionCategory` (+ updatedAt).
// Output never includes player names (minors) — counts and number → position only.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST is not a local address.');
  process.exit(1);
}

const FILE = 'reference/jersey-numbers.json';
if (!existsSync(FILE)) {
  console.log(`${FILE} not found — skipping jersey numbers.`);
  process.exit(0);
}
const cfg = JSON.parse(readFileSync(FILE, 'utf8'));

admin.initializeApp({ projectId: 'volley-skills' });
const db = admin.firestore();

const norm = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const listed = new Map(Object.entries(cfg.players ?? {}).map(([k, v]) => [norm(k), v]));

const teams = await db.collection('teams').where('createdBy', '==', 'seed-script').limit(1).get();
if (teams.empty) {
  console.error('No seeded team found — run `npm run seed:emulator` first.');
  process.exit(1);
}
const teamRef = teams.docs[0].ref;
const docs = (await teamRef.collection('players').limit(50).get()).docs;
const players = docs.map((d) => ({
  ref: d.ref,
  position: d.data().positionCategory,
  first: norm(String(d.data().fullName ?? '').split(/\s+/)[0]),
  number: null,
  setPosition: null,
}));

const used = new Set();
const take = (p, n) => {
  p.number = n;
  used.add(n);
};

// 1. Listed players
for (const p of players) {
  const entry = listed.get(p.first);
  if (!entry) continue;
  if (used.has(entry.number)) {
    console.warn(`Config assigns #${entry.number} twice — a later player is treated as unlisted.`);
    continue;
  }
  take(p, entry.number);
  if (entry.position) {
    p.position = entry.position;
    p.setPosition = entry.position;
  }
}

// 2. Unlisted: field pool, then libero if the team has none
const unlisted = players.filter((p) => p.number === null);
const fieldPool = (cfg.autoAssign?.fieldNumbers ?? []).filter((n) => !used.has(n));
const liberoPool = (cfg.autoAssign?.liberoNumbers ?? []).filter((n) => !used.has(n));
const hasLibero = players.some((p) => p.position === 'L');
if (!hasLibero) {
  const cand = unlisted.find((p) => p.position === 'U');
  if (cand && liberoPool.length) {
    take(cand, liberoPool.shift());
    cand.position = 'L';
    cand.setPosition = 'L';
  }
}
for (const p of unlisted) {
  if (p.number !== null) continue;
  const n = fieldPool.find((x) => !used.has(x));
  if (n !== undefined) take(p, n);
}
// 3. Overflow
const overflow = [];
let next = 19;
for (const p of players) {
  if (p.number !== null) continue;
  while (used.has(next)) next += 1;
  take(p, next);
  overflow.push(p);
}

const batch = db.batch();
for (const p of players) {
  const update = { number: p.number, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (p.setPosition) update.positionCategory = p.setPosition;
  batch.update(p.ref, update);
}
await batch.commit();

console.log(`Updated ${players.length} players: ${players.length - unlisted.length} from config, ${unlisted.length} auto-assigned.`);
if (overflow.length) {
  console.warn(`Warning: pools ran out; ${overflow.length} player(s) got fallback numbers: ${overflow.map((p) => `#${p.number} (${p.position})`).join(', ')}`);
}
console.log('number → position');
for (const p of [...players].sort((a, b) => a.number - b.number)) console.log(`  #${p.number} → ${p.position}`);
