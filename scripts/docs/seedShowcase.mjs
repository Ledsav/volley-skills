#!/usr/bin/env node
// Prepares the LOCAL emulator for docs screenshots and marketing material.
// Run after `npm run dev:emulator` has seeded (it seeds Men 1, matches, library).
//
//   node scripts/docs/seedShowcase.mjs
//
// 1. Deletes the workbook-seeded team (createdBy 'seed-script'): its players come
//    from the club's real spreadsheet and are minors, so they must never appear
//    in a screenshot. Only the fictional "Men 1" squad remains.
// 2. Fills Men 1 with what the pages need to look used: a team development plan,
//    calendar sessions around today, physical tests over three dates, and one
//    player with a full development plan and coach notes.
//
// Emulator-only (refuses any non-local FIRESTORE_EMULATOR_HOST). Rerunnable.

import { createRequire } from 'node:module';

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

const TEAM_ID = 'seed-men-1';
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

// 1. Real-spreadsheet team out.
for (const t of (await db.collection('teams').where('createdBy', '==', 'seed-script').get()).docs) {
  await db.recursiveDelete(t.ref);
  console.log(`Deleted workbook team ${t.id} (real player data, not for screenshots).`);
}

const teamRef = db.collection('teams').doc(TEAM_ID);
const team = (await teamRef.get()).data();
if (!team) {
  console.error(`Team ${TEAM_ID} not found — run npm run dev:emulator (or seed:men1) first.`);
  process.exit(1);
}
const coach = team.adminEmails?.[0] ?? 'coach@example.com';

// 2a. Team development plan.
await teamRef.update({
  description: 'Senior men — first team. Training Tue/Thu, matches on Saturday.',
  developmentPlan: {
    shortTermObjectives: [
      { objective: 'Side-out above 60% in serve receive', targetDate: addDays(21), status: 'In progress', coachComment: 'Up from 52% after the passing block.' },
      { objective: 'Fewer than 6 service errors per set', targetDate: addDays(35), status: 'Active', coachComment: 'Float serve to zone 1 and 5 first.' },
      { objective: 'Quick-middle tempo with both setters', targetDate: addDays(-7), status: 'Completed', coachComment: 'Tom now runs the 1 ball reliably.' },
    ],
    seasonObjectives: [
      { objective: 'Finish top 3 in the league', target: 'Top 3', status: 'In progress', coachComment: '' },
      { objective: 'Every player tested 3× in the season', target: '3 testing sessions', status: 'Active', coachComment: '' },
    ],
    generalNotes: 'Focus block for October: serve receive and transition after a dig.',
  },
});

// 2b. Calendar sessions around today, using the seeded trainings.
const trainings = (await db.collection('trainings').orderBy('businessId').limit(3).get()).docs;
const cal = teamRef.collection('calendar');
for (const d of (await cal.get()).docs) await d.ref.delete();
const offsets = [-14, -12, -7, -5, 0, 2, 7, 9];
for (const [i, off] of offsets.entries()) {
  const t = trainings[i % trainings.length];
  if (!t) break;
  await cal.add({
    date: addDays(off), trainingId: t.id, trainingBusinessId: t.data().businessId, trainingName: t.data().name,
    notes: '', createdBy: 'seed-showcase', createdAt: now,
  });
}

// 2c. Physical tests on three dates for every player; one featured player with a full plan.
const players = (await teamRef.collection('players').orderBy('number').get()).docs;
const dates = [addDays(-120), addDays(-60), addDays(-3)];
const jitter = (seed, k) => ((seed * 37 + k * 11) % 7) - 3;
for (const p of players) {
  const n = p.data().number;
  const tests = p.ref.collection('physicalTests');
  for (const d of (await tests.get()).docs) await d.ref.delete();
  for (const [k, date] of dates.entries()) {
    const gain = k * 1.5;
    const cmj = Math.round(42 + jitter(n, k) + gain);
    const sprint = Number((1.92 - k * 0.03 + jitter(n, k) * 0.01).toFixed(2));
    const common = { date, notes: '', recordedBy: coach, createdAt: now };
    await tests.add({ ...common, testType: 'cmj', attemptsCm: [cmj - 2, cmj, cmj - 1], bestCm: cmj });
    await tests.add({ ...common, testType: 'sprint10m', attemptsSeconds: [sprint + 0.04, sprint], bestSeconds: sprint });
    await tests.add({ ...common, testType: 'growth', heightCm: 182 + (n % 9) * 2, bodyMassKg: 76 + (n % 7) * 2 + k });
    const reach = 236 + (n % 9) * 2;
    const touch = reach + 62 + Math.round(gain) + jitter(n, k);
    await tests.add({ ...common, testType: 'approachJump', standingReachCm: reach, attemptsTouchCm: [touch - 3, touch], bestTouchCm: touch, approachJumpCm: touch - reach });
  }
}

const featured = players.find((p) => p.data().number === 7) ?? players[0];
const skills = { ...featured.data().skills };
skills.reception = { ...skills.reception, notes: 'Platform angle drifts on short serves to zone 5.', priority: true };
skills.attack = { ...skills.attack, notes: 'Strong line shot; add the high-hands tool.', priority: false };
skills.serve = { ...skills.serve, notes: 'Jump-float is consistent; work on depth.', priority: true };
await featured.ref.update({
  developmentPlan: {
    shortTermObjectives: [
      { objective: 'Reception: 2.2 average on a 0–3 scale', targetDate: addDays(28), status: 'In progress', coachComment: '2.0 in the last two matches.' },
      { objective: 'Jump-float serve deep to zone 1', targetDate: addDays(14), status: 'Active', coachComment: '' },
    ],
    seasonObjectives: [
      { objective: 'Starting outside hitter all season', target: '20+ starts', status: 'In progress', coachComment: '' },
      { objective: 'Approach jump +5 cm', target: '+5 cm vs September', status: 'Attention', coachComment: 'Plateaued since the last test.' },
    ],
    generalNotes: 'Leader on court. Keep pushing the passing work — it decides his minutes.',
  },
  skills,
  updatedAt: now,
});

console.log(`Showcase ready: ${players.length} players with physical tests, ${offsets.length} calendar sessions, featured player #${featured.data().number}.`);
process.exit(0);
