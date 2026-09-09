import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { withBackoff } from '../firebase/withBackoff';
import { parseScene } from './parseScene';
import type { Diagram, Scene } from '../types/diagram';

const MAX_DIAGRAMS = 12;

export interface DiagramSaveOps {
  creates: { tempId: string; title: string; order: number; scene: Scene }[];
  updates: { id: string; title: string; order: number; scene: Scene }[];
  deletes: string[];
}

function colRef(exerciseId: string) {
  return collection(db, 'exercises', exerciseId, 'diagrams');
}

export async function listDiagrams(exerciseId: string): Promise<Diagram[]> {
  const snap = await getDocs(query(colRef(exerciseId), orderBy('order'), limit(MAX_DIAGRAMS)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Diagram);
}

export async function getFirstDiagram(exerciseId: string): Promise<Diagram | null> {
  const snap = await getDocs(query(colRef(exerciseId), orderBy('order'), limit(1)));
  const first = snap.docs[0];
  return first ? ({ id: first.id, ...first.data() } as Diagram) : null;
}

export async function saveDiagramSet(
  exerciseId: string,
  ops: DiagramSaveOps,
  uid: string,
): Promise<{ idMap: Record<string, string> }> {
  for (const entry of [...ops.creates, ...ops.updates]) {
    const parsed = parseScene(entry.scene);
    if (!parsed.ok) throw new Error(`Diagram "${entry.title}" is invalid: ${parsed.error}`);
  }

  const batch = writeBatch(db);
  const idMap: Record<string, string> = {};

  for (const c of ops.creates) {
    const ref = doc(colRef(exerciseId));
    idMap[c.tempId] = ref.id;
    batch.set(ref, {
      title: c.title,
      order: c.order,
      scene: c.scene,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  }
  for (const u of ops.updates) {
    batch.update(doc(db, 'exercises', exerciseId, 'diagrams', u.id), {
      title: u.title,
      order: u.order,
      scene: u.scene,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  }
  for (const id of ops.deletes) {
    batch.delete(doc(db, 'exercises', exerciseId, 'diagrams', id));
  }

  await withBackoff(() => batch.commit());
  return { idMap };
}
