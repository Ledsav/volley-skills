import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { DocumentData } from 'firebase/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildAcceptance } from '../../src/legal/acceptance';
import { inForce } from '../../src/legal/versions';
import { acceptanceDoc, legalUpdate } from '../../src/signup/signupDocs';
import {
  authTimeAgo,
  dbAs,
  getTestEnv,
  OPERATOR,
  seedClub,
  seedPlatformAdmin,
  type Firestore,
  type SeedClubOptions,
} from './testEnv';

const ADMIN = 'admin-a@example.com';
const COACH = 'coach-a@example.com';
const VERSION = 'terms-x_dpa-x';
const CLUB_A: SeedClubOptions = { id: 'club-a', admins: [ADMIN], ownerEmail: ADMIN, members: [COACH] };

function acceptance(acceptedBy: string) {
  return {
    versionKey: VERSION,
    termsVersion: 'x',
    dpaVersion: 'x',
    subprocessorsVersion: 'x',
    language: 'en',
    termsSha256: 'a'.repeat(64),
    dpaSha256: 'b'.repeat(64),
    clausesSha256: 'c'.repeat(64),
    specificClauses: [],
    acceptedBy,
    acceptedByName: 'Someone',
    authorityConfirmed: true,
    authTime: 0,
    userAgent: 'seed',
  };
}

interface Reaccept {
  key: string;
  authTime: number;
  acceptance: DocumentData;
}

/** A re-acceptance of the versions in force, signed by `email` a minute after a fresh sign-in. */
async function reacceptParts(email: string): Promise<Reaccept> {
  const now = new Date();
  const authTime = authTimeAgo(60);
  const a = await buildAcceptance({
    termsVersion: inForce('terms', now).version,
    dpaVersion: inForce('dpa', now).version,
    subprocessorsVersion: inForce('subprocessors', now).version,
    language: 'en',
    email,
    personName: 'Club Officer',
    authTime,
    userAgent: 'Mozilla/5.0 (rules test)',
  });
  return { key: a.versionKey, authTime, acceptance: acceptanceDoc(a) };
}

/** The re-acceptance batch: the new acceptance record and the club's legal pointing at it. */
function reaccept(db: Firestore, p: Reaccept): Promise<void> {
  const batch = db.batch();
  batch.set(db.doc(`clubs/club-a/acceptances/${p.key}`), p.acceptance);
  batch.update(db.doc('clubs/club-a'), legalUpdate(p.key, String(p.acceptance.acceptedBy)));
  return batch.commit();
}

describe('club acceptances rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, CLUB_A);
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

  it('lets an active club admin re-accept: new acceptance plus legal update in one batch', async () => {
    const env = await getTestEnv();
    const p = await reacceptParts(ADMIN);
    const db = dbAs(env, ADMIN, { authTime: p.authTime });
    await assertSucceeds(reaccept(db, p));
    const club = await db.doc('clubs/club-a').get();
    expect(club.data()?.legal).toMatchObject({ versionKey: p.key, acceptedBy: ADMIN });
    // A pending club's admin can accept too; a suspended club's admin cannot.
    for (const [status, ok] of [['pending', true], ['suspended', false]] as const) {
      await env.clearFirestore();
      await seedClub(env, { ...CLUB_A, status });
      await (ok ? assertSucceeds : assertFails)(reaccept(db, p));
    }
  });

  it('refuses re-acceptance by a member', async () => {
    const env = await getTestEnv();
    const p = await reacceptParts(COACH);
    await assertFails(reaccept(dbAs(env, COACH, { authTime: p.authTime }), p));
    // Nor can a member record the admin as the signer.
    const asAdmin = await reacceptParts(ADMIN);
    await assertFails(reaccept(dbAs(env, COACH, { authTime: asAdmin.authTime }), asAdmin));
  });

  it('refuses re-acceptance by a club admin who is the platform admin', async () => {
    const env = await getTestEnv();
    await seedClub(env, { ...CLUB_A, admins: [ADMIN, OPERATOR] });
    const p = await reacceptParts(OPERATOR);
    await assertFails(reaccept(dbAs(env, OPERATOR, { authTime: p.authTime }), p));
    // The acceptance alone, too.
    await assertFails(
      dbAs(env, OPERATOR, { authTime: p.authTime }).doc(`clubs/club-a/acceptances/${p.key}`).set(p.acceptance)
    );
    // Control: the other admin of the same club can.
    const q = await reacceptParts(ADMIN);
    await assertSucceeds(reaccept(dbAs(env, ADMIN, { authTime: q.authTime }), q));
  });

  it('refuses updating or deleting an acceptance', async () => {
    const env = await getTestEnv();
    for (const who of [ADMIN, OPERATOR, COACH]) {
      const db = dbAs(env, who, { authTime: authTimeAgo(60) });
      await assertFails(db.doc(`clubs/club-a/acceptances/${VERSION}`).update({ acceptedByName: 'Changed' }));
      await assertFails(db.doc(`clubs/club-a/acceptances/${VERSION}`).delete());
    }
    // Re-signing over an existing record (a set on it is an update), even in a valid batch.
    const p = await reacceptParts(ADMIN);
    const db = dbAs(env, ADMIN, { authTime: p.authTime });
    await assertSucceeds(reaccept(db, p));
    await assertFails(db.doc(`clubs/club-a/acceptances/${p.key}`).set({ ...p.acceptance }));
    await assertFails(reaccept(db, p));
  });

  it('refuses an acceptance without the matching legal update', async () => {
    const env = await getTestEnv();
    const p = await reacceptParts(ADMIN);
    const db = dbAs(env, ADMIN, { authTime: p.authTime });
    await assertFails(db.doc(`clubs/club-a/acceptances/${p.key}`).set(p.acceptance));
    // The club pointing at another version.
    const batch = db.batch();
    batch.set(db.doc(`clubs/club-a/acceptances/${p.key}`), p.acceptance);
    batch.update(db.doc('clubs/club-a'), legalUpdate(VERSION, ADMIN));
    await assertFails(batch.commit());
  });
});
