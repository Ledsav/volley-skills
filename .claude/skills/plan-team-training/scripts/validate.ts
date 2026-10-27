// Checks a proposal against the live library snapshot (recon.json) and the app's own rules,
// then renders the training PDF as a preview. Exit code 1 when any check fails.
//
//   npx vite-node .claude/skills/plan-team-training/scripts/validate.ts <proposal.mjs> \
//     --recon <recon.json> [--out <preview.pdf>]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { en } from '../../../../src/i18n/en';
import { validateExerciseRows } from '../../../../src/exercises/exercisesImport';
import { EXERCISE_FOCUSES, followsExerciseNaming } from '../../../../src/trainings/naming';
import { buildTrainingDocDefinition } from '../../../../src/trainings/pdf/buildTrainingPdf';
import { diagramToPdfSvg } from '../../../../src/trainings/pdf/diagramToPdfSvg';
import { EXERCISE_CATEGORIES, PLAYER_LIMITS } from '../../../../src/types/exercise';
import { parseArgs, norm } from './lib.mjs';

const args = parseArgs();
const [proposalPath] = args._;
if (!proposalPath || !args.recon) throw new Error('usage: validate.ts <proposal.mjs> --recon <recon.json> [--out preview.pdf]');
const { plan, training, newExercises = [] } = await import(pathToFileURL(resolve(proposalPath)).href);
const recon = JSON.parse(readFileSync(args.recon, 'utf8'));

const errors: string[] = [];
const warnings: string[] = [];
const CATEGORY_KEYS = EXERCISE_CATEGORIES.map((c) => c.key) as string[];
const focusOk = (f: string) => (EXERCISE_FOCUSES as readonly string[]).some((x) => x.toLowerCase() === f.trim().toLowerCase());

// Training shape and naming: "Focus + focus: objective".
const [focusPart, objective] = String(training.name).split(/:(.*)/s);
if (!objective?.trim() || !focusPart.split('+').every(focusOk)) errors.push(`training name "${training.name}" must be "Focus + focus: objective" (focuses: ${EXERCISE_FOCUSES.join(', ')})`);
if (recon.trainings.some((t: { name: string }) => norm(t.name) === norm(training.name))) errors.push(`a training named "${training.name}" already exists`);
if (!training.ageGroupTarget) errors.push('training.ageGroupTarget is required');
if (!Array.isArray(training.targets) || training.targets.length === 0 || !training.targets.every((t: string) => CATEGORY_KEYS.includes(t))) errors.push(`targets must be 1+ of: ${CATEGORY_KEYS.join(', ')}`);
const { min: spMin, max: spMax } = PLAYER_LIMITS.suggestedPlayers;
if (!Number.isInteger(training.suggestedPlayers) || training.suggestedPlayers < spMin || training.suggestedPlayers > spMax) errors.push(`suggestedPlayers must be a whole number ${spMin}-${spMax}`);
if (training.suggestedPlayers !== plan.expectedPlayers) warnings.push(`suggestedPlayers (${training.suggestedPlayers}) differs from plan.expectedPlayers (${plan.expectedPlayers})`);
for (const label of ['Purpose:', 'Session flow', 'Group size:']) if (!training.description.includes(label)) errors.push(`training description lacks "${label}"`);
if (/\bblocks? \d/i.test(training.description)) errors.push('training description says "block N": refer to parts as "#N" like the PDF');

// New exercises: the app's import validator (name, category, minPlayers, diagram scenes), naming, structure.
const libraryNames = new Map<string, number>();
for (const e of recon.exercises) libraryNames.set(e.name, (libraryNames.get(e.name) ?? 0) + 1);
const v = validateExerciseRows(newExercises);
errors.push(...v.errors.map((e: string) => `new exercise ${e}`));
for (const n of newExercises) {
  if (!followsExerciseNaming(n.name)) errors.push(`new exercise "${n.name}" must be "Focus: what it trains"`);
  if (libraryNames.has(n.name)) errors.push(`new exercise "${n.name}" already exists in the library`);
  if (n.minPlayers == null) errors.push(`new exercise "${n.name}" needs minPlayers`);
  for (const label of ['Purpose:', 'Setup:', 'How it runs:', 'Coaching points:']) if (!n.description.includes(label)) errors.push(`new exercise "${n.name}" description lacks "${label}"`);
  if (!n.diagrams?.length) warnings.push(`new exercise "${n.name}" has no diagram`);
  for (const d of n.diagrams ?? []) {
    const texts = [d.title, ...d.scene.items.filter((i: { type: string }) => i.type === 'text').map((i: { content: string }) => i.content)];
    if (texts.some((s: string) => s.includes('→'))) warnings.push(`"${n.name}": avoid "→" in diagram titles/text`);
  }
}

// Steps resolve, fit the expected turnout minus the slack, and fit the time slot.
const floor = Math.max(1, plan.expectedPlayers - plan.playerSlack);
type Ex = { id?: string; name: string; category: string; minPlayers: number | null; description: string };
const resolved: Ex[] = [];
for (const s of training.steps) {
  const fromNew = newExercises.find((n: Ex) => n.name === s.name);
  const lib = recon.exercises.filter((e: Ex) => e.name === s.name);
  if (fromNew) resolved.push(fromNew);
  else if (lib.length === 1) resolved.push(lib[0]);
  else {
    const close = recon.exercises.filter((e: Ex) => norm(e.name).includes(norm(s.name).split(' ').slice(-1)[0])).map((e: Ex) => e.name).slice(0, 3);
    errors.push(lib.length > 1 ? `step "${s.name}" matches ${lib.length} library exercises` : `step "${s.name}" is not in the library or newExercises${close.length ? ` (close: ${close.join(' | ')})` : ''}`);
    continue;
  }
  const ex = resolved[resolved.length - 1];
  if (ex.minPlayers == null) warnings.push(`"${s.name}" has no minPlayers in the library; check it runs with ${floor}`);
  else if (ex.minPlayers > floor) errors.push(`"${s.name}" needs ${ex.minPlayers} players but the session must run with ${floor} (${plan.expectedPlayers} - ${plan.playerSlack})`);
  if (!Number.isInteger(s.minutes) || s.minutes < 1 || s.minutes > 60) errors.push(`"${s.name}": minutes must be 1-60`);
}
// Variety: flag steps the team did in its recent sessions (recon.recent).
for (const s of training.steps) {
  const seen = (recon.recent ?? []).filter((r: { exercises: string[] }) => r.exercises.includes(s.name));
  if (seen.length) warnings.push(`"${s.name}" repeats the team's recent session${seen.length > 1 ? 's' : ''} ${seen.map((r: { date: string; businessId: string }) => `${r.date} ${r.businessId}`).join(', ')}`);
}
const total = training.steps.reduce((a: number, s: { minutes: number }) => a + s.minutes, 0);
if (total > plan.slotMinutes) errors.push(`steps total ${total} min, over the ${plan.slotMinutes}-min slot`);
else if (total > plan.slotMinutes - 5) warnings.push(`steps total ${total} min leave under 5 min of the ${plan.slotMinutes}-min slot for setup`);
for (const s of training.steps) if (!training.description.includes(s.name)) warnings.push(`session flow in the description does not mention "${s.name}"`);

// Privacy: written texts are shared outside the app; no roster names in them.
const nameTokens = new Set<string>();
for (const p of recon.roster) for (const tok of norm(p.fullName).split(' ')) if (tok.length > 3) nameTokens.add(tok);
const written = [training.name, training.description, ...newExercises.flatMap((n: { name: string; description: string }) => [n.name, n.description])].join(' ');
const leaked = norm(written).split(' ').filter((w) => nameTokens.has(w));
if (leaked.length) errors.push(`player names in shared texts: ${[...new Set(leaked)].join(', ')} — use levels, not names`);

// Preview through the real PDF pipeline (library exercises appear without their diagrams).
if (args.out) {
  const require = createRequire(import.meta.url);
  const pdfmake = require('pdfmake');
  const F = 'node_modules/pdfmake/fonts/Roboto/';
  pdfmake.setFonts({ Roboto: { normal: F + 'Roboto-Regular.ttf', bold: F + 'Roboto-Medium.ttf', italics: F + 'Roboto-Italic.ttf', bolditalics: F + 'Roboto-MediumItalic.ttf' } });
  pdfmake.setUrlAccessPolicy(() => false);
  const exercisesById = new Map();
  const diagramsById = new Map();
  const steps = training.steps.map((s: { name: string; minutes: number }, i: number) => {
    const ex = resolved.find((e) => e.name === s.name);
    const id = `x${i}`;
    if (ex) exercisesById.set(id, { id, name: ex.name, category: ex.category, minPlayers: ex.minPlayers ?? undefined, description: ex.description, createdBy: '', createdAt: null });
    const nd = newExercises.find((n: { name: string }) => n.name === s.name);
    if (nd) diagramsById.set(id, (nd.diagrams ?? []).map((d: { title: string; scene: unknown }, k: number) => ({ id: `${id}d${k}`, title: d.title, order: k, scene: d.scene })));
    return { exerciseId: id, order: i + 1, durationMinutes: s.minutes };
  });
  const def = buildTrainingDocDefinition({
    t: en,
    training: { id: 'preview', businessId: 'TR-NEW', name: training.name, description: training.description, ageGroupTarget: training.ageGroupTarget, suggestedPlayers: training.suggestedPlayers, targets: training.targets, exercises: steps, exerciseIds: [], createdBy: '', createdAt: null },
    exercisesById,
    diagramsById,
    svgFor: (d) => diagramToPdfSvg(d.scene),
  });
  await pdfmake.createPdf(def).write(args.out);
  console.log(`preview: ${args.out}`);
}

console.log(`steps ${training.steps.length}, ${total} of ${plan.slotMinutes} min; must run with ${floor}-${plan.expectedPlayers + plan.playerSlack} players; ${newExercises.length} new exercise(s)`);
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(errors.length ? `RESULT: ${errors.length} error(s)` : 'RESULT: OK');
process.exit(errors.length ? 1 : 0);
