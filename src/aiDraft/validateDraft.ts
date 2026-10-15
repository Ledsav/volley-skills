import { AiError } from '../ai/aiClient';
import { isPlainObject } from '../bulkImport/parseJsonArray';
import { parseScene } from '../diagrams/parseScene';
import { newId } from '../diagrams/sceneFactory';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../types/exercise';
import { SCENE_LIMITS, type CourtPreset, type DiagramItem, type Scene } from '../types/diagram';
import { DRAFT_ITEM_TYPES, DRAFT_LIMITS, type ExerciseDraft } from './types';

const CATEGORY_KEYS = new Set<string>(EXERCISE_CATEGORIES.map((c) => c.key));
const COURTS: CourtPreset[] = ['full', 'half', 'blank'];
const ALLOWED = new Set<string>(DRAFT_ITEM_TYPES);

export function isCategory(v: unknown): v is ExerciseCategory {
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
  return {
    key: newId(),
    name,
    category,
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
