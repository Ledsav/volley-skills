#!/usr/bin/env node
// Seeds two more clubs next to the demo club, to try the multi-club app locally:
//
//   clubs/rival     "Rival Volley"  active   admin rival@example.com   (one team, two players, one exercise; AI and growth tests off)
//   clubs/newclub   "New Club"      pending  admin pending@example.com (nothing else)
//
// platformAdmins/operator@example.com is written with no membership in any club: it reaches
// /platform only and never sees club data.
// Sign in as nobody@example.com (no membership) to see the welcome page.
// Emulator-only; re-runnable (the clubs are rewritten from scratch).
//
//   node scripts/seed/seedClubs.mjs

import { createRequire } from 'node:module';
import { clubRoot, writeClub } from './clubArg.mjs';
import { SKILL_KEYS } from './parseWorkbook.mjs';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST is not a local address.');
  process.exit(1);
}
admin.initializeApp({ projectId: 'volley-skills' });
const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();

const RIVAL_ADMIN = 'rival@example.com';
const PENDING_ADMIN = 'pending@example.com';
const OPERATOR = 'operator@example.com';

// --- clubs/rival ----------------------------------------------------------
await db.recursiveDelete(clubRoot(db, 'rival'));
await writeClub(db, { id: 'rival', name: 'Rival Volley', status: 'active', admins: [RIVAL_ADMIN], aiEnabled: false, growthTestsEnabled: false });

const rival = clubRoot(db, 'rival');
const team = { name: 'Rival U17', ageGroup: 'U17', season: '2026-27' };
const teamRef = rival.collection('teams').doc('rival-u17');
const skills = (score) => Object.fromEntries(SKILL_KEYS.map((k) => [k, { score, notes: '', priority: false }]));
const level = (avg) => (avg < 4 ? 'Beginner' : avg < 6 ? 'Developing' : avg < 8 ? 'Advanced' : 'Elite');

const batch = db.batch();
batch.set(teamRef, {
  ...team,
  description: '',
  notes: '',
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  adminEmails: [RIVAL_ADMIN],
  createdBy: 'seed-script',
  createdAt: now,
});
[
  { fullName: 'Rival Player One', number: 4, positionCategory: 'OH', score: 6 },
  { fullName: 'Rival Player Two', number: 9, positionCategory: 'S', score: 5 },
].forEach((p, i) => {
  batch.set(teamRef.collection('players').doc(`rival-p${i + 1}`), {
    number: p.number,
    fullName: p.fullName,
    dob: '2009-05-01',
    nationality: '',
    licenseNumber: '',
    positionCategory: p.positionCategory,
    shirtSize: '',
    starting: false,
    playerPhone: '',
    guardians: [],
    viewerEmails: [],
    teamName: team.name,
    ageGroup: team.ageGroup,
    season: team.season,
    skills: skills(p.score),
    avgScore: p.score,
    level: level(p.score),
    developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
    consent: { given: false, date: null, confirmedBy: null },
    createdBy: 'seed-script',
    createdAt: now,
    updatedAt: now,
  });
});
batch.set(rival.collection('exercises').doc('rival-pepper'), {
  name: 'Rival pepper',
  description: 'Pairs 4–5 m apart. Dig, set, attack in a continuous rally.',
  category: 'warmup',
  createdBy: 'seed-script',
  createdAt: now,
});
await batch.commit();

// --- clubs/newclub (pending: club doc + admin member only) ------------------
await db.recursiveDelete(clubRoot(db, 'newclub'));
await writeClub(db, { id: 'newclub', name: 'New Club', status: 'pending', admins: [PENDING_ADMIN] });

await db.doc(`platformAdmins/${OPERATOR}`).set({ addedBy: 'seed-script', addedAt: now });

console.log('Done. clubs/rival (active: 1 team, 2 players, 1 exercise) and clubs/newclub (pending); platformAdmins/' + OPERATOR + ' (no club).');
console.log(`Sign in as ${RIVAL_ADMIN} (Rival Volley), ${PENDING_ADMIN} (pending screen) or nobody@example.com (welcome page).`);
process.exit(0);
