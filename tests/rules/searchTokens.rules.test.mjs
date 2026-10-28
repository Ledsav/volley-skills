// Emulator test of the searchTokens backfill core (UI redesign plan 3).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { searchTokens } from '../../src/search/searchTokens.js';
import { backfillSearchTokens } from '../../scripts/migrate/searchTokensRun.mjs';
import { adminDb, put } from './adminDb.mjs';
import { getTestEnv } from './testEnv';

let db;

beforeEach(async () => {
  const env = await getTestEnv();
  await env.clearFirestore();
  db = adminDb();
  await put(db, {
    'clubs/demo/exercises/e1': { name: 'Rete attacco' },
    'clubs/demo/exercises/e2': { name: 'Servizio float' },
    'clubs/demo/exercises/e3': { name: 'Bagher', searchTokens: searchTokens('Bagher') },
    'clubs/demo/trainings/t1': { name: 'Sessione base', businessId: 'TR-0001' },
    'clubs/demo/trainings/t2': { name: 'Sessione forza', businessId: 'TR-0002' },
  });
});

afterAll(async () => {
  const env = await getTestEnv();
  await env.cleanup();
});

describe('backfillSearchTokens', () => {
  it('backfills missing tokens and reports counts', async () => {
    expect(await backfillSearchTokens(db, 'demo', {})).toEqual({ read: 5, written: 4, skipped: 1 });
    expect((await db.doc('clubs/demo/exercises/e1').get()).data().searchTokens).toEqual(searchTokens('Rete attacco'));
    expect((await db.doc('clubs/demo/trainings/t1').get()).data().searchTokens).toEqual(searchTokens('Sessione base', 'TR-0001'));
    expect((await db.doc('clubs/demo/trainings/t2').get()).data().searchTokens).toContain('tr-0002');
  });

  it('is idempotent', async () => {
    await backfillSearchTokens(db, 'demo', {});
    expect(await backfillSearchTokens(db, 'demo', {})).toEqual({ read: 5, written: 0, skipped: 5 });
  });

  it('dry run writes nothing', async () => {
    expect(await backfillSearchTokens(db, 'demo', { dryRun: true })).toEqual({ read: 5, written: 4, skipped: 1 });
    expect((await db.doc('clubs/demo/exercises/e1').get()).data().searchTokens).toBeUndefined();
  });
});
