import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { withBackoff } from '../firebase/withBackoff';
import { MAX_IMPORT } from '../bulkImport/parseJsonArray';
import type { NewTrainingInput, Training } from '../types/training';
import { formatBusinessId } from './businessId';

const TRAININGS_PAGE_SIZE = 25;

export async function createTraining(
  input: NewTrainingInput,
  creatorUid: string
): Promise<{ id: string; businessId: string }> {
  const counterRef = doc(db, 'counters', 'trainings');
  const trainingRef = doc(collection(db, 'trainings'));

  const businessId = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const lastSequence = counterSnap.exists() ? (counterSnap.data().lastSequence as number) : 0;
    const nextSequence = lastSequence + 1;
    const nextBusinessId = formatBusinessId(nextSequence);

    tx.set(counterRef, { lastSequence: nextSequence });
    tx.set(trainingRef, {
      businessId: nextBusinessId,
      ...input,
      exerciseIds: input.exercises.map((e) => e.exerciseId),
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
    });

    return nextBusinessId;
  });

  return { id: trainingRef.id, businessId };
}

export async function updateTraining(trainingId: string, updates: Partial<NewTrainingInput>): Promise<void> {
  const payload: Record<string, unknown> = { ...updates };
  if (updates.exercises) {
    payload.exerciseIds = updates.exercises.map((e) => e.exerciseId);
  }
  await updateDoc(doc(db, 'trainings', trainingId), payload);
}

export async function deleteTraining(trainingId: string): Promise<void> {
  await deleteDoc(doc(db, 'trainings', trainingId));
}

export interface TrainingsPage {
  trainings: Training[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export async function listTrainings(
  afterDoc: QueryDocumentSnapshot | null = null,
  filters: { ageGroupTarget?: string } = {}
): Promise<TrainingsPage> {
  const base = collection(db, 'trainings');
  const constraints = [
    ...(filters.ageGroupTarget ? [where('ageGroupTarget', '==', filters.ageGroupTarget)] : []),
    orderBy('businessId'),
    ...(afterDoc ? [startAfter(afterDoc)] : []),
    limit(TRAININGS_PAGE_SIZE),
  ];
  const snapshot = await getDocs(query(base, ...constraints));
  const trainings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Training);
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { trainings, lastDoc, hasMore: snapshot.docs.length === TRAININGS_PAGE_SIZE };
}

export async function findTrainingByBusinessId(businessId: string): Promise<Training | null> {
  const snapshot = await getDocs(
    query(collection(db, 'trainings'), where('businessId', '==', businessId), limit(1))
  );
  if (snapshot.docs.length === 0) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as Training;
}

export async function getTraining(trainingId: string): Promise<Training | null> {
  const snapshot = await getDoc(doc(db, 'trainings', trainingId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Training;
}

/**
 * Maps each requested exercise name to the ids of exercises with that exact
 * name. Bounded reads: one `where('name','in', chunk)` per 30 distinct names.
 */
export async function resolveExerciseNames(names: string[]): Promise<Map<string, string[]>> {
  const distinct = [...new Set(names.map((s) => s.trim()).filter((s) => s.length > 0))];
  const map = new Map<string, string[]>();
  for (let i = 0; i < distinct.length; i += 30) {
    const chunk = distinct.slice(i, i + 30);
    const snap = await withBackoff(() =>
      getDocs(query(collection(db, 'exercises'), where('name', 'in', chunk)))
    );
    for (const d of snap.docs) {
      const name = d.data().name as string;
      map.set(name, [...(map.get(name) ?? []), d.id]);
    }
  }
  return map;
}

/**
 * Writes N trainings in one transaction, bumping counters/trainings by N so
 * every training gets a sequential businessId. All-or-nothing.
 */
export async function bulkCreateTrainings(
  inputs: NewTrainingInput[],
  creatorUid: string
): Promise<number> {
  if (inputs.length === 0) return 0;
  if (inputs.length > MAX_IMPORT) throw new Error(`bulk import is capped at ${MAX_IMPORT} entries per call`);
  const counterRef = doc(db, 'counters', 'trainings');

  // The SDK already retries the transaction internally; this outer withBackoff
  // only adds a few paced retries if the whole transaction still surfaces a
  // transient overload error. Safe to layer: every re-run re-reads the counter
  // and re-derives all businessIds, so a retry is idempotent.
  await withBackoff(() =>
    runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      const lastSequence = counterSnap.exists() ? (counterSnap.data().lastSequence as number) : 0;

      inputs.forEach((input, i) => {
        const trainingRef = doc(collection(db, 'trainings'));
        tx.set(trainingRef, {
          businessId: formatBusinessId(lastSequence + i + 1),
          ...input,
          exerciseIds: input.exercises.map((e) => e.exerciseId),
          createdBy: creatorUid,
          createdAt: serverTimestamp(),
        });
      });

      tx.set(counterRef, { lastSequence: lastSequence + inputs.length });
    })
  );

  return inputs.length;
}
