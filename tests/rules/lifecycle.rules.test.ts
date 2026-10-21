import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import type { ClubStatus } from '../../src/types/club';
import { dbAs, getTestEnv, seedClub, type SeedClubOptions } from './testEnv';

const ADMIN = 'admin@example.com';
const COACH = 'coach@example.com'; // a plain member and team admin of team-1

const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(Date.now() + days * DAY);

type Probe = 'readTeam' | 'writeTeam' | 'readGuide' | 'readMembers';
const PROBES: Probe[] = ['readTeam', 'writeTeam', 'readGuide', 'readMembers'];
const ALL = PROBES;
const READS: Probe[] = ['readTeam', 'readGuide', 'readMembers'];
const NOTHING: Probe[] = [];

interface Row {
  state: string;
  status: ClubStatus;
  termination?: SeedClubOptions['termination'];
  coach: Probe[];
  admin: Probe[];
}

const ROWS: Row[] = [
  { state: 'pending', status: 'pending', coach: ['readMembers'], admin: ['readMembers'] },
  { state: 'active', status: 'active', coach: ALL, admin: ALL },
  { state: 'suspended', status: 'suspended', coach: NOTHING, admin: READS },
  {
    state: 'terminating, before effectiveAt',
    status: 'terminating',
    termination: { effectiveAt: at(1), retrievalEndsAt: at(31) },
    coach: ALL,
    admin: ALL,
  },
  {
    state: 'terminating, in the retrieval window',
    status: 'terminating',
    termination: { effectiveAt: at(-1), retrievalEndsAt: at(29) },
    coach: NOTHING,
    admin: READS,
  },
  {
    state: 'terminating, after retrievalEndsAt',
    status: 'terminating',
    termination: { effectiveAt: at(-31), retrievalEndsAt: at(-1) },
    coach: NOTHING,
    admin: NOTHING,
  },
  { state: 'deleted', status: 'deleted', coach: NOTHING, admin: NOTHING },
];

async function probe(who: string, which: Probe): Promise<unknown> {
  const db = dbAs(await getTestEnv(), who);
  switch (which) {
    case 'readTeam':
      return db.doc('clubs/club-a/teams/team-1').get();
    case 'writeTeam':
      return db.doc('clubs/club-a/teams/team-1').update({ name: `Renamed by ${who}` });
    case 'readGuide':
      return db.doc('clubs/club-a/config/skillGuide').get();
    case 'readMembers':
      return db.collection('clubs/club-a/members').get();
  }
}

describe('club lifecycle gating by state and role', () => {
  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  describe.each(ROWS)('$state', (row) => {
    beforeEach(async () => {
      const env = await getTestEnv();
      await env.clearFirestore();
      await seedClub(env, {
        id: 'club-a',
        status: row.status,
        admins: [ADMIN],
        members: [COACH],
        termination: row.termination,
      });
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc('clubs/club-a/teams/team-1').set({ name: 'U17', adminEmails: [COACH], createdBy: 'seed' });
        await db.doc('clubs/club-a/config/skillGuide').set({ skills: [] });
      });
    });

    const cases = (['coach', 'admin'] as const).flatMap((role) =>
      PROBES.map((p) => [role, p, row[role].includes(p)] as const)
    );
    it.each(cases)('%s %s -> allowed: %s', async (role, which, allowed) => {
      const who = role === 'coach' ? COACH : ADMIN;
      if (allowed) await assertSucceeds(probe(who, which));
      else await assertFails(probe(who, which));
    });

    it('still lets members get the club doc (for the status screen)', async () => {
      const env = await getTestEnv();
      await assertSucceeds(dbAs(env, COACH).doc('clubs/club-a').get());
      await assertSucceeds(dbAs(env, ADMIN).doc('clubs/club-a').get());
      await assertFails(dbAs(env, 'outsider@example.com').doc('clubs/club-a').get());
    });
  });
});
