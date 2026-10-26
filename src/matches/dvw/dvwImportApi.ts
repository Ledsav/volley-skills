import { doc, getDocs, limit, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { EMPTY_RESULT, type Match, type MatchEvent } from '../../types/match';
import { buildFinishPayload } from '../finish';
import { deleteMatch, eventsCol, finishMatch, getUsageProfile, matchDoc, matchesCol } from '../matchesApi';
import { replay } from '../scoutEngine';
import type { DvwPlan } from './mapDvw';

/** Firestore allows 500 writes per batch; stay well under. */
const BATCH_SIZE = 450;

export interface ImportMeta {
  fileName: string;
  fileSha256: string;
  generator: string;
  warnings: number;
}

/** Everything a retry needs: ids are generated once, so rewriting a batch is idempotent. */
export interface ImportJob {
  matchId: string;
  eventIds: string[];
  /** Index of the next event batch to commit. */
  nextBatch: number;
  /** The match doc is written once; a retry must not touch `import` again (rules allow it on create only). */
  matchWritten: boolean;
  uid: string;
  meta: ImportMeta;
}

export async function findImportedMatch(
  teamId: string,
  fileSha256: string,
): Promise<{ id: string; date: string; opponent: string } | null> {
  const snapshot = await getDocs(query(matchesCol(teamId), where('import.fileSha256', '==', fileSha256), limit(1)));
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  const data = d.data() as { date: string; opponent: string };
  return { id: d.id, date: data.date, opponent: data.opponent };
}

export function startImport(teamId: string, plan: DvwPlan, meta: ImportMeta, uid: string): ImportJob {
  const matchId = doc(matchesCol(teamId)).id;
  const eventIds = plan.events.map(() => doc(eventsCol(teamId, matchId)).id);
  return { matchId, eventIds, nextBatch: 0, matchWritten: false, uid, meta };
}

export async function runImport(
  teamId: string,
  plan: DvwPlan,
  job: ImportJob,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const total = plan.events.length;
  if (!job.matchWritten) {
    await setDoc(matchDoc(teamId, job.matchId), {
      ...plan.setup,
      status: 'setup',
      result: EMPTY_RESULT,
      summary: null,
      report: null,
      usageContribution: null,
      activeDevice: null,
      import: {
        format: 'dvw',
        fileName: job.meta.fileName,
        fileSha256: job.meta.fileSha256,
        generator: job.meta.generator,
        importedAt: serverTimestamp(),
        importedBy: job.uid,
        warnings: job.meta.warnings,
      },
      createdBy: job.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    job.matchWritten = true;
  }
  onProgress(Math.min(job.nextBatch * BATCH_SIZE, total), total);
  while (job.nextBatch * BATCH_SIZE < total) {
    const from = job.nextBatch * BATCH_SIZE;
    const to = Math.min(from + BATCH_SIZE, total);
    const batch = writeBatch(db);
    for (let i = from; i < to; i++) {
      batch.set(doc(eventsCol(teamId, job.matchId), job.eventIds[i]), {
        ...plan.events[i],
        createdBy: job.uid,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
    job.nextBatch += 1;
    onProgress(to, total);
  }

  const match: Match = {
    ...plan.setup,
    id: job.matchId,
    status: 'setup',
    result: EMPTY_RESULT,
    summary: null,
    usageContribution: null,
    activeDevice: null,
    createdBy: job.uid,
    createdAt: null,
    updatedAt: null,
  };
  const events: MatchEvent[] = plan.events.map((e, i) => ({ ...e, id: job.eventIds[i] }) as MatchEvent);
  const profile = await getUsageProfile(teamId);
  await finishMatch(teamId, job.matchId, buildFinishPayload(match, replay(match, events), profile));
}

/** Removes a partial or unwanted import (events, then the match). */
export function discardImport(teamId: string, matchId: string): Promise<void> {
  return deleteMatch(teamId, matchId);
}
