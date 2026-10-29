// Writes an approved, validated proposal. DRY RUN unless --apply.
//
//   node .claude/skills/plan-team-training/scripts/apply.mjs <proposal.mjs> --owner <email> \
//     [--club <id>] [--emulator] [--calendar YYYY-MM-DD] [--apply]
//   node .claude/skills/plan-team-training/scripts/apply.mjs --rollback <applied-*.json> [--club <id>] [--emulator] [--apply]
//
// Creates the new exercises (+ diagrams), then the training with the next businessId from
// counters/trainings (same transaction shape as the app), then, with --calendar, a session on
// the plan's team. Every created path goes to applied-<timestamp>.json next to the proposal, so
// --rollback can delete exactly those docs (the businessId counter is not rewound).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dataRoot, norm, openDb, parseArgs } from './lib.mjs';
import { searchTokens } from '../../../../src/search/searchTokens.js';

const args = parseArgs();
const APPLY = Boolean(args.apply);
const { admin, db, target } = await openDb(args);
const { FieldValue } = admin.firestore;

if (args.rollback) {
  const log = JSON.parse(readFileSync(args.rollback, 'utf8'));
  const paths = [...(log.calendar ? [log.calendar] : []), ...(log.training ? [log.training.path] : []), ...log.exercises.flatMap((e) => [...e.diagrams, e.path])];
  console.log(`${APPLY ? 'Deleting' : 'Would delete'} ${paths.length} docs on ${target}:\n  ${paths.join('\n  ')}`);
  if (APPLY) {
    const batch = db.batch();
    for (const p of paths) batch.delete(db.doc(p));
    await batch.commit();
    console.log('Rolled back (the businessId counter is not rewound).');
  } else console.log('\nDRY RUN — re-run with --apply.');
  process.exit(0);
}

const proposalPath = resolve(args._[0] ?? '');
const { plan, training, newExercises = [] } = await import(pathToFileURL(proposalPath).href);
if (!args.owner) throw new Error('--owner <email> is required (becomes createdBy)');
const { root, layout } = await dataRoot(db, args);

const owner = await db.collection('users').where('email', '==', String(args.owner).toLowerCase()).limit(1).get();
if (owner.empty) throw new Error(`no users doc for ${args.owner}`);
const uid = owner.docs[0].id;

// Fresh reads: the library may have changed since validation.
const library = (await root.collection('exercises').get()).docs;
const byName = new Map();
for (const d of library) byName.set(d.data().name, [...(byName.get(d.data().name) ?? []), d]);
for (const n of newExercises) if (byName.has(n.name)) throw new Error(`"${n.name}" already exists — refusing to duplicate`);
const trainings = (await root.collection('trainings').get()).docs;
if (trainings.some((d) => norm(d.data().name) === norm(training.name))) throw new Error(`training "${training.name}" already exists — refusing to duplicate`);
for (const s of training.steps) {
  const hits = byName.get(s.name) ?? [];
  if (!newExercises.some((n) => n.name === s.name) && hits.length !== 1) throw new Error(`step "${s.name}" resolves to ${hits.length} library exercises`);
}
let teamRef = null;
if (args.calendar) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.calendar)) throw new Error('--calendar must be YYYY-MM-DD');
  const team = (await root.collection('teams').get()).docs.find((t) => norm(t.data().name) === norm(plan.team));
  if (!team) throw new Error(`no team "${plan.team}" for the calendar entry`);
  teamRef = team.ref;
}

console.log(`Target: ${target}, layout ${layout}, owner ${args.owner} (${uid})`);
console.log(`New exercises: ${newExercises.map((n) => `${n.name} (${n.diagrams?.length ?? 0} diagram)`).join(', ') || 'none'}`);
console.log(`Training: ${training.name} — ${training.steps.length} steps, ${training.steps.reduce((a, s) => a + s.minutes, 0)} min, suggested ${training.suggestedPlayers}, targets ${training.targets.join(', ')}`);
if (teamRef) console.log(`Calendar: ${plan.team} on ${args.calendar}`);
if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply after the coach approved.');
  process.exit(0);
}

const logPath = join(dirname(proposalPath), `applied-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const log = { target, layout, exercises: [], training: null, calendar: null };
const save = () => writeFileSync(logPath, JSON.stringify(log, null, 2));

for (const n of newExercises) {
  const ref = root.collection('exercises').doc();
  const batch = db.batch();
  batch.set(ref, { name: n.name, description: n.description, category: n.category, minPlayers: n.minPlayers, searchTokens: searchTokens(n.name), createdBy: uid, createdAt: FieldValue.serverTimestamp() });
  const diagrams = (n.diagrams ?? []).map((d, i) => {
    const dref = ref.collection('diagrams').doc();
    batch.set(dref, { title: d.title, order: i, scene: d.scene, updatedBy: uid, updatedAt: FieldValue.serverTimestamp() });
    return dref.path;
  });
  await batch.commit();
  log.exercises.push({ name: n.name, path: ref.path, diagrams });
  save();
  byName.set(n.name, [{ id: ref.id }]);
  console.log(`created exercise ${n.name} (${ref.id})`);
}

const steps = training.steps.map((s, i) => ({ exerciseId: byName.get(s.name)[0].id, order: i + 1, durationMinutes: s.minutes }));
const counterRef = root.collection('counters').doc('trainings');
const trainingRef = root.collection('trainings').doc();
const businessId = await db.runTransaction(async (tx) => {
  const c = await tx.get(counterRef);
  const next = (c.exists ? c.data().lastSequence : 0) + 1;
  const biz = `TR-${String(next).padStart(4, '0')}`;
  tx.set(counterRef, { lastSequence: next });
  tx.set(trainingRef, {
    businessId: biz,
    name: training.name,
    searchTokens: searchTokens(training.name, biz),
    description: training.description,
    ageGroupTarget: training.ageGroupTarget,
    suggestedPlayers: training.suggestedPlayers,
    targets: training.targets,
    exercises: steps,
    exerciseIds: steps.map((s) => s.exerciseId),
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return biz;
});
log.training = { path: trainingRef.path, businessId };
save();
console.log(`created training ${businessId} · ${training.name} (${trainingRef.id})`);

if (teamRef) {
  const cal = teamRef.collection('calendar').doc();
  await cal.set({ date: args.calendar, trainingId: trainingRef.id, trainingBusinessId: businessId, trainingName: training.name, notes: '', createdBy: uid, createdAt: FieldValue.serverTimestamp() });
  log.calendar = cal.path;
  save();
  console.log(`added to ${plan.team}'s calendar on ${args.calendar}`);
}

const check = await trainingRef.get();
console.log(`verified: ${check.data().businessId} has ${check.data().exercises.length} steps`);
console.log(`log: ${logPath}`);
process.exit(0);
