import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub, seedClubTree, type SeedClubOptions } from './testEnv';

// Everything the club export (src/clubs/export/clubExportApi.ts) reads: id-ordered
// pages of each collection, plus single gets where a list cannot pass the rules
// (config names its doc ids). No rules change backs this file; it pins the boundary.

const ADMIN = 'admin@example.com';
const COACH = 'coach@example.com';
const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(Date.now() + days * DAY);

const c = 'clubs/club-a';
const team = `${c}/teams/team-1`;
const LIST_PATHS = [
  `${c}/members`,
  `${c}/acceptances`,
  `${c}/statusLog`,
  `${c}/teams`,
  `${team}/players`,
  `${team}/players/p1/physicalTests`,
  `${team}/calendar`,
  `${team}/testingSessions`,
  `${team}/testingSessions/ts1/entries`,
  `${team}/matches`,
  `${team}/matches/m1/events`,
  `${team}/awards`,
  `${team}/scoutProfile`,
  `${c}/exercises`,
  `${c}/exercises/x1/diagrams`,
  `${c}/trainings`,
  `${c}/counters`,
  `${c}/sectionAccess`,
];
const GET_PATHS = [c, `${c}/config/skillGuide`, `${c}/config/physicalTestGuide`];

async function list(who: string, path: string) {
  return dbAs(await getTestEnv(), who)
    .collection(path)
    .orderBy(firebase.firestore.FieldPath.documentId())
    .limit(200)
    .get();
}

async function get(who: string, path: string) {
  return dbAs(await getTestEnv(), who).doc(path).get();
}

async function seed(status: SeedClubOptions['status'], termination?: SeedClubOptions['termination']) {
  const env = await getTestEnv();
  await env.clearFirestore();
  await seedClub(env, { id: 'club-a', status, admins: [ADMIN], members: [COACH], termination });
  await seedClubTree(env, 'club-a', 'team-1', [COACH]);
}

afterAll(async () => {
  const env = await getTestEnv();
  await env.cleanup();
});

const EXPORT_STATES: Array<{ state: string; status: SeedClubOptions['status']; termination?: SeedClubOptions['termination'] }> = [
  { state: 'active', status: 'active' },
  { state: 'suspended', status: 'suspended' },
  {
    state: 'terminating, in the retrieval window',
    status: 'terminating',
    termination: { effectiveAt: at(-1), retrievalEndsAt: at(29) },
  },
];

describe.each(EXPORT_STATES)('club admin export reads: $state', ({ status, termination }) => {
  beforeEach(async () => {
    await seed(status, termination);
  });

  it.each(LIST_PATHS)('admin can list %s', async (path) => {
    await assertSucceeds(list(ADMIN, path));
  });

  it.each(GET_PATHS)('admin can get %s', async (path) => {
    await assertSucceeds(get(ADMIN, path));
  });
});

describe('after the retrieval window', () => {
  beforeEach(async () => {
    await seed('terminating', { effectiveAt: at(-31), retrievalEndsAt: at(-1) });
  });

  it.each([`${c}/teams`, `${c}/members`])('admin cannot list %s', async (path) => {
    await assertFails(list(ADMIN, path));
  });
});

describe('a plain member of a suspended club', () => {
  beforeEach(async () => {
    await seed('suspended');
  });

  it.each([`${c}/teams`, `${team}/players`])('cannot list %s', async (path) => {
    await assertFails(list(COACH, path));
  });
});
