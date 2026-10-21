import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, OPERATOR, seedClub, seedPlatformAdmin, serverTimestamp } from './testEnv';

const ADMIN = 'admin-a@example.com';
const COACH = 'coach-a@example.com';
const VERSION = 'terms-x_dpa-x';

function acceptance(acceptedBy: string) {
  return {
    versionKey: VERSION,
    termsVersion: 'x',
    dpaVersion: 'x',
    language: 'en',
    termsSha256: 'a'.repeat(64),
    dpaSha256: 'b'.repeat(64),
    clausesSha256: 'c'.repeat(64),
    specificClauses: [],
    acceptedBy,
    acceptedByName: 'Someone',
    authorityConfirmed: true,
  };
}

describe('club acceptances rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, { id: 'club-a', admins: [ADMIN], ownerEmail: ADMIN, members: [COACH] });
    await seedPlatformAdmin(env, OPERATOR);
    await env.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc(`clubs/club-a/acceptances/${VERSION}`)
        .set({ ...acceptance(ADMIN), acceptedAt: new Date() });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets club admins and the platform admin read acceptances; members cannot', async () => {
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, ADMIN).doc(`clubs/club-a/acceptances/${VERSION}`).get());
    await assertSucceeds(dbAs(env, ADMIN).collection('clubs/club-a/acceptances').get());
    await assertSucceeds(dbAs(env, OPERATOR).doc(`clubs/club-a/acceptances/${VERSION}`).get());
    await assertFails(dbAs(env, COACH).doc(`clubs/club-a/acceptances/${VERSION}`).get());
    await assertFails(dbAs(env, 'outsider@example.com').doc(`clubs/club-a/acceptances/${VERSION}`).get());
  });

  it('refuses every client create, update and delete, including for club admins and the platform admin', async () => {
    const env = await getTestEnv();
    for (const who of [ADMIN, OPERATOR, COACH]) {
      const db = dbAs(env, who);
      await assertFails(
        db
          .doc('clubs/club-a/acceptances/terms-y_dpa-y')
          .set({ ...acceptance(who), versionKey: 'terms-y_dpa-y', acceptedAt: serverTimestamp() })
      );
      await assertFails(db.doc(`clubs/club-a/acceptances/${VERSION}`).update({ acceptedByName: 'Changed' }));
      await assertFails(db.doc(`clubs/club-a/acceptances/${VERSION}`).delete());
    }
  });
});
