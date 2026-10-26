// READ-ONLY. Gathers what a team training needs: the team's roster with levels and
// skills, a match of the coach's names against it, the exercise library, existing
// trainings and the team's upcoming calendar.
//
//   node .claude/skills/plan-team-training/scripts/recon.mjs --team "U17" \
//     --players "Chloé Hens; Anouk Brambati; Fenia Kouvara" [--club demo] [--emulator] [--out dir]
//
// Writes <out>/recon.json (default .superpowers/plan-training/<today>/) and prints a summary.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataRoot, norm, openDb, parseArgs, today } from './lib.mjs';

const args = parseArgs();
if (!args.team) throw new Error('--team "<team name>" is required');
const out = args.out ?? join('.superpowers', 'plan-training', today());
mkdirSync(out, { recursive: true });

const { db, target } = await openDb(args);
const { root, layout } = await dataRoot(db, args);
console.log(`Reading ${target}, layout ${layout} (read-only)`);

const teams = (await root.collection('teams').get()).docs;
const team = teams.find((t) => norm(t.data().name) === norm(args.team));
if (!team) throw new Error(`No team named "${args.team}". Teams: ${teams.map((t) => t.data().name).join(', ')}`);

const roster = (await team.ref.collection('players').get()).docs
  .map((p) => ({ id: p.id, ...p.data() }))
  .filter((p) => !p.leftClubAt)
  .map((p) => ({
    id: p.id,
    fullName: p.fullName,
    number: p.number ?? 0,
    position: p.positionCategory ?? 'TBD',
    level: p.level ?? null,
    avgScore: p.avgScore ?? null,
    skills: Object.fromEntries(Object.entries(p.skills ?? {}).map(([k, v]) => [k, v?.score ?? null])),
    priorities: Object.entries(p.skills ?? {}).filter(([, v]) => v?.priority).map(([k]) => k),
    unscored: Object.values(p.skills ?? {}).every((v) => v?.score == null),
  }));

// Match each typed name: exact (all tokens present), fuzzy (surname matches with spaces
// removed, e.g. "Brambati" ~ "Esposti"; or a single shared token), or unmatched.
const compact = (s) => norm(s).replace(/ /g, '');
function matchName(query) {
  const q = norm(query).split(' ').filter(Boolean);
  const exact = roster.filter((p) => q.every((t) => norm(p.fullName).split(' ').includes(t)));
  if (exact.length === 1) return { query, kind: 'exact', player: exact[0] };
  const last = q[q.length - 1];
  const fuzzy = roster.filter((p) => compact(p.fullName).includes(last) || q.some((t) => t.length > 3 && norm(p.fullName).split(' ').includes(t)));
  if (fuzzy.length >= 1) return { query, kind: fuzzy.length === 1 ? 'fuzzy' : 'ambiguous', candidates: fuzzy };
  return { query, kind: 'unmatched' };
}
const queries = String(args.players ?? '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
const matches = queries.map(matchName);

const exercises = [];
for (const d of (await root.collection('exercises').get()).docs) {
  const x = d.data();
  const diagrams = await d.ref.collection('diagrams').count().get();
  exercises.push({ id: d.id, name: x.name, category: x.category, minPlayers: x.minPlayers ?? null, diagrams: diagrams.data().count, description: x.description ?? '' });
}
const trainings = (await root.collection('trainings').get()).docs.map((d) => {
  const x = d.data();
  return { id: d.id, businessId: x.businessId, name: x.name, ageGroupTarget: x.ageGroupTarget, suggestedPlayers: x.suggestedPlayers ?? null, targets: x.targets ?? [], steps: (x.exercises ?? []).length };
});
const calendar = (await team.ref.collection('calendar').where('date', '>=', today()).orderBy('date').limit(10).get()).docs.map((c) => ({ id: c.id, ...c.data() }));

// The team's last sessions and the exercises they used, so a new plan can avoid repeating them.
const exerciseName = new Map(exercises.map((e) => [e.id, e.name]));
const recent = [];
for (const c of (await team.ref.collection('calendar').where('date', '<', today()).orderBy('date', 'desc').limit(Number(args.recent ?? 5)).get()).docs) {
  const s = c.data();
  const tr = await root.collection('trainings').doc(s.trainingId).get();
  const steps = tr.exists ? (tr.data().exercises ?? []).map((e) => exerciseName.get(e.exerciseId)).filter(Boolean) : [];
  recent.push({ date: s.date, businessId: s.trainingBusinessId, name: s.trainingName, exercises: [...new Set(steps)] });
}

const recon = { generatedAt: new Date().toISOString(), target, layout, club: args.club ?? null, team: { id: team.id, ...team.data() }, roster, matches, exercises, trainings, calendar, recent };
writeFileSync(join(out, 'recon.json'), JSON.stringify(recon, null, 2));

const fmt = (p) => `${p.fullName} | ${p.position} | ${p.level ?? 'not rated'}${p.avgScore != null ? ` ${p.avgScore.toFixed(1)}` : ''}${p.unscored ? ' | NO SCORES' : ''}${p.priorities.length ? ` | priorities: ${p.priorities.join(', ')}` : ''}`;
console.log(`\nTeam ${team.data().name}: ${roster.length} active players`);
for (const m of matches) {
  if (m.kind === 'exact') console.log(`  OK        ${m.query} -> ${fmt(m.player)}`);
  else if (m.kind === 'unmatched') console.log(`  MISSING   ${m.query} -> not in the app (ask the coach for a level; never invent one)`);
  else console.log(`  CONFIRM   ${m.query} -> ${m.candidates.map((p) => p.fullName).join(' / ')} (${m.kind}; confirm with the coach)`);
}
console.log(`\nLibrary: ${exercises.length} exercises (${exercises.filter((e) => e.minPlayers == null).length} without minPlayers), ${trainings.length} trainings`);
console.log(`Upcoming calendar: ${calendar.map((c) => `${c.date} ${c.trainingBusinessId}`).join(', ') || 'none'}`);
console.log(`Recent sessions (avoid repeating their exercises):`);
for (const r of recent) console.log(`  ${r.date} ${r.businessId} ${r.name}: ${r.exercises.join(' | ') || '(training not found)'}`);
if (!recent.length) console.log('  none');
console.log(`\nWrote ${join(out, 'recon.json')}`);
process.exit(0);
