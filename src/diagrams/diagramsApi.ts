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
import { emptyScene } from './sceneFactory';
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

/**
 * Map a raw Firestore document to a `Diagram`, running its scene through
 * `parseScene`. A malformed scene is replaced with an empty one so a single bad
 * doc renders blank instead of white-screening `/exercises` inside `renderItem`.
 */
function toDiagram(id: string, data: Record<string, unknown>): Diagram {
  const parsed = parseScene(data.scene);
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Untitled',
    order: typeof data.order === 'number' ? data.order : 0,
    scene: parsed.ok ? parsed.scene : emptyScene('full'),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listDiagrams(exerciseId: string): Promise<Diagram[]> {
  const snap = await getDocs(query(colRef(exerciseId), orderBy('order'), limit(MAX_DIAGRAMS)));
  return snap.docs.map((d) => toDiagram(d.id, d.data() as Record<string, unknown>));
}

export async function getFirstDiagram(exerciseId: string): Promise<Diagram | null> {
  const snap = await getDocs(query(colRef(exerciseId), orderBy('order'), limit(1)));
  const first = snap.docs[0];
  return first ? toDiagram(first.id, first.data() as Record<string, unknown>) : null;
}

export async function saveDiagramSet(
  exerciseId: string,
  ops: DiagramSaveOps,
  uid: string,
): Promise<{ idMap: Record<string, string> }> {
  // Validate + repair every scene once, keyed by its entry, and write THAT —
  // otherwise clamp-corrected values (e.g. size: 100 → 2) never get persisted.
  const repaired = new Map<object, Scene>();
  for (const entry of [...ops.creates, ...ops.updates]) {
    if (entry.title.trim().length < 1 || entry.title.length > 40) {
      throw new Error(
        `Diagram "${entry.title || '(untitled)'}" needs a title of 1–40 characters.`,
      );
    }
    const parsed = parseScene(entry.scene);
    if (!parsed.ok) throw new Error(`Diagram "${entry.title}" is invalid: ${parsed.error}`);
    repaired.set(entry, parsed.scene);
  }

  const batch = writeBatch(db);
  const idMap: Record<string, string> = {};

  for (const c of ops.creates) {
    const ref = doc(colRef(exerciseId));
    idMap[c.tempId] = ref.id;
    batch.set(ref, {
      title: c.title,
      order: c.order,
      scene: repaired.get(c) ?? c.scene,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  }
  for (const u of ops.updates) {
    batch.update(doc(db, 'exercises', exerciseId, 'diagrams', u.id), {
      title: u.title,
      order: u.order,
      scene: repaired.get(u) ?? u.scene,
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
