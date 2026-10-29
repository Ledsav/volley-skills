import {
  addDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { clubCol, clubDoc } from '../firebase/clubPaths';
import { withBackoff } from '../firebase/withBackoff';
import { MAX_IMPORT } from '../bulkImport/parseJsonArray';
import { saveDiagramSet } from '../diagrams/diagramsApi';
import { optionalForCreate, optionalForUpdate } from '../firebase/optionalFields';
import { searchTokens } from '../search/searchTokens.js';
import type { Exercise, ExerciseCategory, ExerciseUpdate, NewExerciseInput } from '../types/exercise';
import type { ExerciseImportInput, ImportedDiagram } from './exercisesImport';

const EXERCISES_PAGE_SIZE = 25;

export async function createExercise(input: NewExerciseInput, creatorUid: string): Promise<string> {
  const docRef = await addDoc(clubCol('exercises'), {
    ...optionalForCreate(input, ['minPlayers']),
    searchTokens: searchTokens(input.name),
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function bulkCreateExercises(
  inputs: ExerciseImportInput[],
  creatorUid: string
): Promise<number> {
  if (inputs.length > MAX_IMPORT) throw new Error(`bulk import is capped at ${MAX_IMPORT} entries per call`);

  // Phase 1: create every exercise doc in one atomic batch, keeping each
  // pre-generated ref so its id can anchor the diagrams written next.
  const created: { ref: DocumentReference; diagrams: ImportedDiagram[] }[] = [];
  const batch = writeBatch(db);
  for (const input of inputs) {
    const { diagrams, ...exercise } = input;
    const ref = doc(clubCol('exercises'));
    batch.set(ref, { ...optionalForCreate(exercise, ['minPlayers']), searchTokens: searchTokens(exercise.name), createdBy: creatorUid, createdAt: serverTimestamp() });
    created.push({ ref, diagrams });
  }
  await withBackoff(() => batch.commit());

  // Phase 2: write each exercise's diagrams via saveDiagramSet (it revalidates
  // + batches <=12 writes per exercise). Sequential is fine for a one-off import.
  // If a call fails here the exercises are already committed with no rollback —
  // the admin re-adds the missing diagrams through the editor.
  for (const { ref, diagrams } of created) {
    if (diagrams.length === 0) continue;
    await saveDiagramSet(
      ref.id,
      {
        creates: diagrams.map((d, i) => ({
          tempId: `imp-${i}`,
          title: d.title,
          order: d.order,
          scene: d.scene,
        })),
        updates: [],
        deletes: [],
      },
      creatorUid,
    );
  }

  return inputs.length;
}

export async function updateExercise(exerciseId: string, updates: ExerciseUpdate): Promise<void> {
  const payload = optionalForUpdate(updates, ['minPlayers']);
  if (updates.name !== undefined) payload.searchTokens = searchTokens(updates.name);
  await updateDoc(clubDoc('exercises', exerciseId), payload);
}

export async function getExercise(exerciseId: string): Promise<Exercise | null> {
  const snapshot = await getDoc(clubDoc('exercises', exerciseId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Exercise;
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  // Cap the cascade read: an exercise holds at most 12 diagrams (SCENE_LIMITS),
  // so this is never truncating real data but guards against a runaway read.
  const diagrams = await getDocs(
    query(clubCol('exercises', exerciseId, 'diagrams'), limit(12)),
  );
  const batch = writeBatch(db);
  diagrams.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(clubDoc('exercises', exerciseId));
  await withBackoff(() => batch.commit());
}

interface ExercisesPage {
  exercises: Exercise[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export async function listExercises(
  afterDoc: QueryDocumentSnapshot | null = null,
  category: ExerciseCategory | null = null
): Promise<ExercisesPage> {
  const base = clubCol('exercises');
  const constraints = [
    ...(category ? [where('category', '==', category)] : []),
    orderBy('name'),
    ...(afterDoc ? [startAfter(afterDoc)] : []),
    limit(EXERCISES_PAGE_SIZE),
  ];
  const snapshot = await getDocs(query(base, ...constraints));
  const exercises = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Exercise);
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { exercises, lastDoc, hasMore: snapshot.docs.length === EXERCISES_PAGE_SIZE };
}

/**
 * One page of exercises whose category is any of `categories` (the builder's
 * "suggested for your targets"). Served by the (category, name) index.
 */
export async function listExercisesInCategories(
  categories: ExerciseCategory[],
  afterDoc: QueryDocumentSnapshot | null
): Promise<ExercisesPage> {
  if (categories.length === 0 || categories.length > 30) throw new Error('need 1–30 categories');
  const constraints = [
    where('category', 'in', categories),
    orderBy('name'),
    ...(afterDoc ? [startAfter(afterDoc)] : []),
    limit(EXERCISES_PAGE_SIZE),
  ];
  const snapshot = await getDocs(query(clubCol('exercises'), ...constraints));
  const exercises = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Exercise);
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { exercises, lastDoc, hasMore: snapshot.docs.length === EXERCISES_PAGE_SIZE };
}

const SEARCH_PAGE_SIZE = 20;

/** One page of exercises whose name has a word starting with `token` (see searchTokens). */
export async function searchExercises(
  token: string,
  afterDoc: QueryDocumentSnapshot | null = null
): Promise<{ items: Exercise[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const snapshot = await getDocs(
    query(
      clubCol('exercises'),
      where('searchTokens', 'array-contains', token),
      orderBy('name'),
      ...(afterDoc ? [startAfter(afterDoc)] : []),
      limit(SEARCH_PAGE_SIZE)
    )
  );
  const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Exercise);
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { items, lastDoc, hasMore: snapshot.docs.length === SEARCH_PAGE_SIZE };
}

export async function getExercisesByIds(ids: string[]): Promise<Exercise[]> {
  const snaps = await Promise.all(ids.map((id) => getDoc(clubDoc('exercises', id))));
  return snaps
    .filter((snap) => snap.exists())
    .map((snap) => ({ id: snap.id, ...snap.data() }) as Exercise);
}

export async function countTrainingsUsingExercise(exerciseId: string): Promise<number> {
  const q = query(clubCol('trainings'), where('exerciseIds', 'array-contains', exerciseId));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}
