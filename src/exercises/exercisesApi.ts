import {
  addDoc,
  collection,
  deleteDoc,
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
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
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

export async function updateExercise(exerciseId: string, updates: Partial<NewExerciseInput>): Promise<void> {
  await updateDoc(doc(db, 'exercises', exerciseId), updates);
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  await deleteDoc(doc(db, 'exercises', exerciseId));
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
