#!/usr/bin/env node
// Seeds a "Men 1" senior team with 14 adult players into the LOCAL Firestore
// emulator. Adults consent to photos themselves, so consent is recorded as given
// (awards photos and cut-outs work for them).
//
//   npm run seed:men1                       # against a running emulator (127.0.0.1:8080)
//   node scripts/seed/seedMen1.mjs --admin you@example.com
//
// Admin and season come from the team seed.mjs created in the club (--club, default
// demo); --admin overrides the admin. Emulator-only. Rerunnable: the team
// has a fixed id and its players are replaced.

import { createRequire } from 'node:module';
import { MEN1_TEAM, men1Players } from './men1Roster.mjs';
import { clubRoot, parseClubArg } from './clubArg.mjs';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST is not a local address.');
  process.exit(1);
}
admin.initializeApp({ projectId: 'volley-skills' });
const db = admin.firestore();
const club = parseClubArg(process.argv.slice(2));
const root = clubRoot(db, club);
const { FieldValue } = admin.firestore;

const TEAM_ID = 'seed-men-1';

const i = process.argv.indexOf('--admin');
const seeded = (await root.collection('teams').where('createdBy', '==', 'seed-script').limit(1).get()).docs[0]?.data();
const adminEmail = ((i > -1 ? process.argv[i + 1] : null) ?? seeded?.adminEmails?.[0] ?? process.env.SEED_ADMIN_EMAIL ?? 'coach@example.com').toLowerCase();
const team = {
  ...MEN1_TEAM,
  season: seeded?.season ?? '2026-27',
  adminEmails: [adminEmail],
  createdBy: 'seed-script-men1', // not 'seed-script': seedMatch.mjs targets that team
};

const teamRef = root.collection('teams').doc(TEAM_ID);
const old = await teamRef.collection('players').get();
const now = FieldValue.serverTimestamp();
const batch = db.batch();
old.docs.forEach((d) => batch.delete(d.ref));
batch.set(teamRef, { ...team, createdAt: now });
const today = new Date().toISOString().slice(0, 10);
for (const p of men1Players({ team, admin: adminEmail, today })) {
  batch.set(teamRef.collection('players').doc(), { ...p, createdAt: now, updatedAt: now });
}
await batch.commit();

console.log(`Done. Team ${TEAM_ID} ("${team.name}") with 14 adult players, photo consent given. Admin: ${adminEmail}`);
process.exit(0);
