import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { clubTreePaths, dbAs, getTestEnv, seedClub, seedClubTree, serverTimestamp } from './testEnv';

// Club A's people try to reach club B. Club B's team and sections list club A's
// coach by email, so the only thing standing between them is the club boundary.
const ADMIN_A = 'admin-a@example.com';
const COACH_A = 'coach-a@example.com';
const ADMIN_B = 'admin-b@example.com';

const CLUB_B_PATHS = clubTreePaths('club-b', 'team-b', ADMIN_B);
// The mirror of club B inside club A, seeded the same way: the control that the
// same people do reach the same kind of doc in their own club.
const CLUB_A_PATHS = clubTreePaths('club-a', 'team-a', ADMIN_A);
// What a plain member cannot read even in their own club (club-admin only).
const ADMIN_ONLY = ['acceptances/', 'statusLog/'];

const ALL_SECTIONS = { exercises: [COACH_A], trainings: [COACH_A], guides: [COACH_A] };
const PEOPLE = [ADMIN_A, COACH_A];

describe('cross-club isolation', () => {
  beforeAll(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, { id: 'club-a', admins: [ADMIN_A], members: [COACH_A], sections: ALL_SECTIONS });
    await seedClubTree(env, 'club-a', 'team-a', [COACH_A]);
    await seedClub(env, { id: 'club-b', admins: [ADMIN_B], sections: ALL_SECTIONS });
    await seedClubTree(env, 'club-b', 'team-b', [COACH_A]);
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  const ownClub = PEOPLE.flatMap((who) =>
    CLUB_A_PATHS.filter((p) => who === ADMIN_A || !ADMIN_ONLY.some((s) => p.includes(`/${s}`))).map(
      (path) => [who, path] as const
    )
  );
  it.each(ownClub)('control: %s reads %s in their own club', async (who, path) => {
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, who).doc(path).get());
  });

  const matrix = PEOPLE.flatMap((who) => CLUB_B_PATHS.map((path) => [who, path] as const));
  it.each(matrix)('%s cannot get, set or delete %s', async (who, path) => {
    const env = await getTestEnv();
    const db = dbAs(env, who);
    await assertFails(db.doc(path).get());
    await assertFails(db.doc(path).set({ x: 1 }, { merge: true }));
    await assertFails(db.doc(path).delete());
  });

  it('denies listing club-b collections from club-a', async () => {
    const env = await getTestEnv();
    for (const who of PEOPLE) {
      const db = dbAs(env, who);
      await assertFails(db.collection('clubs/club-b/teams').get());
      await assertFails(db.collection('clubs/club-b/teams').where('adminEmails', 'array-contains', who).get());
      await assertFails(db.collection('clubs/club-b/exercises').get());
      await assertFails(db.collection('clubs/club-b/trainings').get());
      await assertFails(db.collection('clubs/club-b/members').get());
      // Control: the same queries in their own club succeed.
      await assertSucceeds(db.collection('clubs/club-a/teams').where('adminEmails', 'array-contains', who).get());
      await assertSucceeds(db.collection('clubs/club-a/members').get());
    }
  });

  it('denies a club-a admin adding themselves as a club-b member', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, ADMIN_A);
    const member = (email: string, clubId: string) => ({
      email,
      clubId,
      role: 'admin',
      addedBy: ADMIN_A,
      addedAt: serverTimestamp(),
    });
    await assertFails(db.doc(`clubs/club-b/members/${ADMIN_A}`).set(member(ADMIN_A, 'club-b')));
    // Control: the same valid create succeeds in their own club.
    await assertSucceeds(db.doc('clubs/club-a/members/new@example.com').set(member('new@example.com', 'club-a')));
  });
});
