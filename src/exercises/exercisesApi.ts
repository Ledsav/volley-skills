import {
  addDoc,
  collection,
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
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { withBackoff } from '../firebase/withBackoff';
import { MAX_IMPORT } from '../bulkImport/parseJsonArray';
import type { Exercise, ExerciseCategory, NewExerciseInput } from '../types/exercise';

const EXERCISES_PAGE_SIZE = 25;

export async function createExercise(input: NewExerciseInput, creatorUid: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'exercises'), {
    ...input,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function bulkCreateExercises(
  inputs: NewExerciseInput[],
  creatorUid: string
): Promise<number> {
  if (inputs.length > MAX_IMPORT) throw new Error(`bulk import is capped at ${MAX_IMPORT} entries per call`);
  const batch = writeBatch(db);
  for (const input of inputs) {
    const ref = doc(collection(db, 'exercises'));
    batch.set(ref, { ...input, createdBy: creatorUid, createdAt: serverTimestamp() });
  }
  await withBackoff(() => batch.commit());
  return inputs.length;
}

export async function updateExercise(exerciseId: string, updates: Partial<NewExerciseInput>): Promise<void> {
  await updateDoc(doc(db, 'exercises', exerciseId), updates);
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  // Cap the cascade read: an exercise holds at most 12 diagrams (SCENE_LIMITS),
  // so this is never truncating real data but guards against a runaway read.
  const diagrams = await getDocs(
    query(collection(db, 'exercises', exerciseId, 'diagrams'), limit(12)),
  );
  const batch = writeBatch(db);
  diagrams.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'exercises', exerciseId));
  await withBackoff(() => batch.commit());
}

export interface ExercisesPage {
  exercises: Exercise[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export async function listExercises(
  afterDoc: QueryDocumentSnapshot | null = null,
  category: ExerciseCategory | null = null
): Promise<ExercisesPage> {
  const base = collection(db, 'exercises');
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

export async function getExercisesByIds(ids: string[]): Promise<Exercise[]> {
  const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, 'exercises', id))));
  return snaps
    .filter((snap) => snap.exists())
    .map((snap) => ({ id: snap.id, ...snap.data() }) as Exercise);
}

export async function countTrainingsUsingExercise(exerciseId: string): Promise<number> {
  const q = query(collection(db, 'trainings'), where('exerciseIds', 'array-contains', exerciseId));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}
