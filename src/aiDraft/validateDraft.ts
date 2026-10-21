import { AiError } from '../ai/aiClient';
import { isPlainObject } from '../bulkImport/parseJsonArray';
import { parseScene } from '../diagrams/parseScene';
import { newId } from '../diagrams/sceneFactory';
import { EXERCISE_CATEGORIES, PLAYER_LIMITS, type ExerciseCategory } from '../types/exercise';
import { SCENE_LIMITS, type CourtPreset, type DiagramItem, type Scene } from '../types/diagram';
import { DRAFT_ITEM_TYPES, DRAFT_LIMITS, type ExerciseDraft, type LibraryIndexEntry, type TrainingDraft, type TrainingStepDraft } from './types';

const CATEGORY_KEYS = new Set<string>(EXERCISE_CATEGORIES.map((c) => c.key));
const COURTS: CourtPreset[] = ['full', 'half', 'blank'];
const ALLOWED = new Set<string>(DRAFT_ITEM_TYPES);

function isCategory(v: unknown): v is ExerciseCategory {
  return typeof v === 'string' && CATEGORY_KEYS.has(v);
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Model diagram → repaired scene. Each item is checked on its own so one bad item doesn't sink the rest. */
export function toDraftScene(raw: unknown): { scene: Scene | null; issues: string[] } {
  if (!isPlainObject(raw)) return { scene: null, issues: ['No diagram was proposed.'] };
  const court = COURTS.includes(raw.court as CourtPreset) ? (raw.court as CourtPreset) : 'full';
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: DiagramItem[] = [];
  let dropped = 0;
  for (const item of rawItems) {
    if (items.length >= SCENE_LIMITS.itemsPerScene) break;
    if (!isPlainObject(item) || typeof item.type !== 'string' || !ALLOWED.has(item.type)) {
      dropped++;
      continue;
    }
    const one = parseScene({ v: 1, court, items: [{ ...item, id: newId() }] });
    if (one.ok && one.scene.items.length === 1) items.push(one.scene.items[0]);
    else dropped++;
  }
  if (items.length === 0) return { scene: null, issues: ['The diagram could not be used.'] };
  const issues = dropped > 0 ? [`${dropped} diagram item${dropped === 1 ? ' was' : 's were'} dropped.`] : [];
  return { scene: { v: 1, court, showZones: raw.showZones === true, items }, issues };
}

export function validateExerciseDraft(raw: unknown): ExerciseDraft | null {
  if (!isPlainObject(raw)) return null;
  const name = text(raw.name, DRAFT_LIMITS.nameMax);
  if (!name) return null;
  const category = isCategory(raw.category) ? raw.category : null;
  const diagram = toDraftScene(raw.diagram);
  const { min, max } = PLAYER_LIMITS.minPlayers;
  const minPlayers = Number.isInteger(raw.minPlayers) && (raw.minPlayers as number) >= min && (raw.minPlayers as number) <= max ? (raw.minPlayers as number) : null;
  return {
    key: newId(),
    name,
    category,
    minPlayers,
    description: text(raw.description, DRAFT_LIMITS.descriptionMax),
    scene: diagram.scene,
    issues: [...(category ? [] : ['Pick a category.']), ...diagram.issues],
  };
}

export function validateExerciseProposals(raw: unknown, count: number): ExerciseDraft[] {
  const list = isPlainObject(raw) && Array.isArray(raw.exercises) ? raw.exercises : [];
  const drafts = list
    .map(validateExerciseDraft)
    .filter((d): d is ExerciseDraft => d !== null)
    .slice(0, count);
  if (drafts.length === 0) throw new AiError('badResponse', 'The model returned no usable exercises.');
  return drafts;
}

function minutes(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 10;
  return Math.max(DRAFT_LIMITS.minutesMin, Math.min(DRAFT_LIMITS.minutesMax, n));
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function validateTrainingProposal(
  raw: unknown,
  opts: { index: LibraryIndexEntry[]; allowNew: boolean; ageGroupTarget: string; targets?: ExerciseCategory[]; suggestedPlayers?: number | null },
): TrainingDraft {
  const obj = isPlainObject(raw) ? raw : {};
  const byId = new Map(opts.index.map((e) => [e.id, e]));
  const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];
  const steps: TrainingStepDraft[] = [];
  let unknownIds = 0;
  let newOff = 0;
  let newNoCategory = 0;
  for (const s of rawSteps) {
    if (steps.length >= DRAFT_LIMITS.maxSteps || !isPlainObject(s)) continue;
    if (typeof s.exerciseId === 'string') {
      const hit = byId.get(s.exerciseId);
      if (!hit) {
        unknownIds++;
        continue;
      }
      steps.push({ kind: 'library', exerciseId: hit.id, name: hit.name, category: hit.category, description: hit.description, minPlayers: hit.minPlayers, minutes: minutes(s.minutes) });
    } else if (isPlainObject(s.new)) {
      if (!opts.allowNew) {
        newOff++;
        continue;
      }
      const exercise = validateExerciseDraft(s.new);
      if (!exercise) continue;
      if (!exercise.category) {
        newNoCategory++;
        continue;
      }
      steps.push({ kind: 'new', exercise, minutes: minutes(s.minutes) });
    }
  }
  if (steps.length === 0) throw new AiError('badResponse', 'The model returned no usable steps.');
  const issues: string[] = [];
  if (unknownIds) issues.push(`${unknownIds} ${plural(unknownIds, 'step used an exercise that is', 'steps used exercises that are')} not in the library and ${plural(unknownIds, 'was', 'were')} dropped.`);
  if (newOff) issues.push(`${newOff} new ${plural(newOff, 'exercise was', 'exercises were')} dropped because new exercises are off.`);
  if (newNoCategory) issues.push(`${newNoCategory} new ${plural(newNoCategory, 'exercise had', 'exercises had')} no valid category and ${plural(newNoCategory, 'was', 'were')} dropped.`);
  return {
    name: text(obj.name, DRAFT_LIMITS.nameMax) || 'AI training',
    description: text(obj.description, DRAFT_LIMITS.descriptionMax),
    // The coach's own age group wins over the model's guess.
    ageGroupTarget: opts.ageGroupTarget || text(obj.ageGroupTarget, 40),
    targets: opts.targets ?? [],
    suggestedPlayers: opts.suggestedPlayers ?? null,
    steps,
    issues,
  };
}
