import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildAcceptance } from '../../src/legal/acceptance';
import { inForce } from '../../src/legal/versions';
import { acceptanceDoc, legalUpdate, signupClubDoc } from '../../src/signup/signupDocs';
import type { ClubStatus } from '../../src/types/club';
import {
  authTimeAgo,
  dbAs,
  getTestEnv,
  OPERATOR,
  seedClub,
  seedPlatformAdmin,
  serverTimestamp,
  type SeedClubOptions,
} from './testEnv';

const ADMIN = 'admin-a@example.com';
const COACH = 'coach-a@example.com';
const CLUB_A: SeedClubOptions = { id: 'club-a', admins: [ADMIN], ownerEmail: ADMIN, members: [COACH] };
const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);

const STATUSES: ClubStatus[] = ['pending', 'active', 'suspended', 'terminating', 'deleted'];
const ALLOWED = new Set([
  'pending>active',
  'pending>deleted',
  'active>suspended',
  'active>terminating',
  'suspended>active',
  'suspended>terminating',
  'terminating>active',
  // The operator changes a terminating club's dates (a fresh log entry each time).
  'terminating>terminating',
]);
// Every from/to pair, self-transitions included (only terminating -> terminating is allowed).
const PAIRS = STATUSES.flatMap((from) =>
  STATUSES.map((to) => ({ from, to, allowed: ALLOWED.has(`${from}>${to}`) }))
);

/** A club seeded in `status`, with termination dates set when it is terminating. */
async function seedClubIn(status: ClubStatus, extra: Partial<SeedClubOptions> = {}) {
  const env = await getTestEnv();
  await seedClub(env, {
    ...CLUB_A,
    status,
    termination:
      status === 'terminating' ? { effectiveAt: inDays(30), retrievalEndsAt: inDays(60) } : undefined,
    ...extra,
  });
}

interface StatusBatch {
  from: ClubStatus;
  to: ClubStatus;
  clubExtra?: Record<string, unknown>;
  log?: Record<string, unknown> | null; // null: no statusLog write
  logId?: string; // default 'log-1'
}

/** The operator's status change: club update + statusLog/log-1 in one batch. */
async function statusBatch({ from, to, clubExtra = {}, log = {}, logId = 'log-1' }: StatusBatch) {
  const env = await getTestEnv();
  const db = dbAs(env, OPERATOR);
  const batch = db.batch();
  const update: Record<string, unknown> = {
    status: to,
    statusReason: 'r',
    statusChangedAt: serverTimestamp(),
    statusChangedBy: OPERATOR,
    lastStatusLogId: logId,
  };
  if (to === 'terminating') {
    update['termination.effectiveAt'] = inDays(30);
    update['termination.retrievalEndsAt'] = inDays(60);
  }
  batch.update(db.doc('clubs/club-a'), { ...update, ...clubExtra });
  if (log !== null) {
    batch.set(db.doc(`clubs/club-a/statusLog/${logId}`), {
      from,
      to,
      reason: 'r',
      by: OPERATOR,
      at: serverTimestamp(),
      ...log,
    });
  }
  return batch.commit();
}

describe('club doc rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, CLUB_A);
    await seedPlatformAdmin(env, OPERATOR);
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a member and the platform admin get the club; others cannot', async () => {
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, COACH).doc('clubs/club-a').get());
    await assertSucceeds(dbAs(env, ADMIN).doc('clubs/club-a').get());
    await assertSucceeds(dbAs(env, OPERATOR).doc('clubs/club-a').get());
    await assertFails(dbAs(env, 'outsider@example.com').doc('clubs/club-a').get());
    await assertFails(env.unauthenticatedContext().firestore().doc('clubs/club-a').get());
  });

  it('lets only the platform admin list clubs', async () => {
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, OPERATOR).collection('clubs').get());
    await assertFails(dbAs(env, ADMIN).collection('clubs').get());
    await assertFails(dbAs(env, COACH).collection('clubs').get());
    await assertFails(dbAs(env, 'outsider@example.com').collection('clubs').get());
  });

  it.each(PAIRS)(
    'allows every transition in the table and refuses the rest: $from -> $to (allowed: $allowed)',
    async ({ from, to, allowed }) => {
      await seedClubIn(from);
      const commit = statusBatch({ from, to });
      await (allowed ? assertSucceeds(commit) : assertFails(commit));
    }
  );

  it('refuses a status change by anyone but the platform admin', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, ADMIN);
    const batch = db.batch();
    batch.update(db.doc('clubs/club-a'), {
      status: 'suspended',
      statusReason: 'r',
      statusChangedAt: serverTimestamp(),
      statusChangedBy: ADMIN,
      lastStatusLogId: 'log-1',
    });
    batch.set(db.doc('clubs/club-a/statusLog/log-1'), {
      from: 'active',
      to: 'suspended',
      reason: 'r',
      by: ADMIN,
      at: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('refuses a status change without its statusLog entry in the same batch', async () => {
    await assertFails(statusBatch({ from: 'active', to: 'suspended', log: null }));
    await assertSucceeds(statusBatch({ from: 'active', to: 'suspended' }));
  });

  it('refuses a later status change that reuses an existing statusLog id', async () => {
    const env = await getTestEnv();
    await assertSucceeds(statusBatch({ from: 'active', to: 'suspended' }));
    // suspended -> active pointing at the already-written log-1, with no new log entry.
    await assertFails(
      dbAs(env, OPERATOR).doc('clubs/club-a').update({
        status: 'active',
        statusReason: 'r',
        statusChangedAt: serverTimestamp(),
        statusChangedBy: OPERATOR,
        lastStatusLogId: 'log-1',
      })
    );
    // The same change with its own fresh log entry goes through.
    await assertSucceeds(statusBatch({ from: 'suspended', to: 'active', logId: 'log-2' }));
  });

  it('refuses a statusLog whose from/to do not match the club change', async () => {
    await assertFails(statusBatch({ from: 'active', to: 'suspended', log: { to: 'terminating' } }));
    await assertFails(statusBatch({ from: 'active', to: 'suspended', log: { from: 'pending' } }));
    await assertFails(statusBatch({ from: 'active', to: 'suspended', log: { by: 'someone@example.com' } }));
    await assertFails(statusBatch({ from: 'active', to: 'suspended', log: { extra: true } }));
    await assertSucceeds(statusBatch({ from: 'active', to: 'suspended' }));
  });

  it('refuses a statusLog written without the matching club change', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, OPERATOR);
    await assertFails(
      db.doc('clubs/club-a/statusLog/log-x').set({
        from: 'active',
        to: 'active',
        reason: null,
        by: OPERATOR,
        at: serverTimestamp(),
      })
    );
  });

  it('refuses suspending without a reason', async () => {
    await assertFails(statusBatch({ from: 'active', to: 'suspended', clubExtra: { statusReason: null } }));
    await assertFails(statusBatch({ from: 'active', to: 'suspended', clubExtra: { statusReason: '' } }));
    await assertFails(
      statusBatch({ from: 'active', to: 'suspended', clubExtra: { statusReason: 'x'.repeat(301) } })
    );
    await assertSucceeds(statusBatch({ from: 'active', to: 'suspended' }));
  });

  it('refuses terminating with retrievalEndsAt under 30 days after effectiveAt', async () => {
    const effectiveAt = inDays(10);
    await assertFails(
      statusBatch({
        from: 'active',
        to: 'terminating',
        clubExtra: {
          'termination.effectiveAt': effectiveAt,
          'termination.retrievalEndsAt': new Date(effectiveAt.getTime() + 29 * DAY),
        },
      })
    );
    await assertFails(
      statusBatch({
        from: 'active',
        to: 'terminating',
        clubExtra: { 'termination.effectiveAt': null, 'termination.retrievalEndsAt': inDays(40) },
      })
    );
    await assertSucceeds(
      statusBatch({
        from: 'active',
        to: 'terminating',
        clubExtra: {
          'termination.effectiveAt': effectiveAt,
          'termination.retrievalEndsAt': new Date(effectiveAt.getTime() + 30 * DAY),
        },
      })
    );
  });

  it('lets the operator change the dates of a terminating club with a fresh log', async () => {
    const env = await getTestEnv();
    await seedClubIn('terminating');
    const effectiveAt = inDays(45);
    const retrievalEndsAt = new Date(effectiveAt.getTime() + 30 * DAY);
    await assertSucceeds(
      statusBatch({
        from: 'terminating',
        to: 'terminating',
        clubExtra: { 'termination.effectiveAt': effectiveAt, 'termination.retrievalEndsAt': retrievalEndsAt },
      })
    );
    const snap = await dbAs(env, OPERATOR).doc('clubs/club-a').get();
    expect(snap.data()?.status).toBe('terminating');
    expect(snap.data()?.termination.effectiveAt.toMillis()).toBe(effectiveAt.getTime());
    expect(snap.data()?.termination.retrievalEndsAt.toMillis()).toBe(retrievalEndsAt.getTime());
    const log = await dbAs(env, OPERATOR).doc('clubs/club-a/statusLog/log-1').get();
    expect(log.data()).toMatchObject({ from: 'terminating', to: 'terminating' });
  });

  it('refuses a date change under 30 days', async () => {
    await seedClubIn('terminating');
    const effectiveAt = inDays(45);
    await assertFails(
      statusBatch({
        from: 'terminating',
        to: 'terminating',
        clubExtra: {
          'termination.effectiveAt': effectiveAt,
          'termination.retrievalEndsAt': new Date(effectiveAt.getTime() + 29 * DAY),
        },
      })
    );
    // A date change still needs its own fresh statusLog entry.
    await assertFails(
      statusBatch({
        from: 'terminating',
        to: 'terminating',
        log: null,
        clubExtra: {
          'termination.effectiveAt': effectiveAt,
          'termination.retrievalEndsAt': new Date(effectiveAt.getTime() + 30 * DAY),
        },
      })
    );
  });

  it('refuses entering terminating with an effectiveAt in the past', async () => {
    // Entering terminating with effectiveAt two days ago.
    const twoDaysAgo = inDays(-2);
    await assertFails(
      statusBatch({
        from: 'active',
        to: 'terminating',
        clubExtra: {
          'termination.effectiveAt': twoDaysAgo,
          'termination.retrievalEndsAt': new Date(twoDaysAgo.getTime() + 30 * DAY),
        },
      })
    );
  });

  it('refuses re-dating a live termination into the past', async () => {
    // Re-dating to 40 days ago (retrieval would have ended 10 days ago).
    await seedClubIn('terminating');
    await assertFails(
      statusBatch({
        from: 'terminating',
        to: 'terminating',
        clubExtra: { 'termination.effectiveAt': inDays(-40), 'termination.retrievalEndsAt': inDays(-10) },
      })
    );
  });

  it('accepts effectiveAt = now (serious breach), entering and re-dating', async () => {
    const now = new Date();
    await assertSucceeds(
      statusBatch({
        from: 'active',
        to: 'terminating',
        clubExtra: {
          'termination.effectiveAt': now,
          'termination.retrievalEndsAt': new Date(now.getTime() + 30 * DAY),
        },
      })
    );
    const again = new Date();
    await assertSucceeds(
      statusBatch({
        from: 'terminating',
        to: 'terminating',
        logId: 'log-2',
        clubExtra: {
          'termination.effectiveAt': again,
          'termination.retrievalEndsAt': new Date(again.getTime() + 30 * DAY),
        },
      })
    );
  });

  it('keeps an end date that has passed when only the export date moves', async () => {
    const env = await getTestEnv();
    const pastEnd = inDays(-10);
    await seedClubIn('terminating', { termination: { effectiveAt: pastEnd, retrievalEndsAt: inDays(20) } });
    // Moving the end date to another past date is refused.
    await assertFails(
      statusBatch({
        from: 'terminating',
        to: 'terminating',
        clubExtra: { 'termination.effectiveAt': inDays(-12), 'termination.retrievalEndsAt': inDays(40) },
      })
    );
    // The kept end date still needs 30 days of export after it.
    await assertFails(
      statusBatch({
        from: 'terminating',
        to: 'terminating',
        clubExtra: {
          'termination.effectiveAt': pastEnd,
          'termination.retrievalEndsAt': new Date(pastEnd.getTime() + 29 * DAY),
        },
      })
    );
    await assertSucceeds(
      statusBatch({
        from: 'terminating',
        to: 'terminating',
        clubExtra: { 'termination.effectiveAt': pastEnd, 'termination.retrievalEndsAt': inDays(40) },
      })
    );
    const snap = await dbAs(env, OPERATOR).doc('clubs/club-a').get();
    expect(snap.data()?.termination.effectiveAt.toMillis()).toBe(pastEnd.getTime());
  });

  it('refuses entering terminating with a stale past end date kept from before', async () => {
    const pastEnd = inDays(-10);
    await seedClubIn('suspended', { termination: { effectiveAt: pastEnd, retrievalEndsAt: inDays(40) } });
    await assertFails(
      statusBatch({
        from: 'suspended',
        to: 'terminating',
        clubExtra: { 'termination.effectiveAt': pastEnd, 'termination.retrievalEndsAt': inDays(40) },
      })
    );
  });

  describe('the termination request on reinstate', () => {
    const REQUESTED = { requestedAt: inDays(-5), requestedBy: ADMIN };
    const CLEARED = {
      'termination.effectiveAt': null,
      'termination.retrievalEndsAt': null,
      'termination.requestedAt': null,
      'termination.requestedBy': null,
    };

    it('reinstating clears the dates and the request (the shape changeClubStatus sends)', async () => {
      const env = await getTestEnv();
      await seedClubIn('terminating', {
        termination: { effectiveAt: inDays(30), retrievalEndsAt: inDays(60), ...REQUESTED },
      });
      await assertSucceeds(statusBatch({ from: 'terminating', to: 'active', clubExtra: CLEARED }));
      const snap = await dbAs(env, OPERATOR).doc('clubs/club-a').get();
      expect(snap.data()?.status).toBe('active');
      expect(snap.data()?.termination).toEqual({
        effectiveAt: null,
        retrievalEndsAt: null,
        requestedAt: null,
        requestedBy: null,
      });
    });

    it('refuses the operator setting the request to a value on reinstate', async () => {
      await seedClubIn('terminating', {
        termination: { effectiveAt: inDays(30), retrievalEndsAt: inDays(60), ...REQUESTED },
      });
      await assertFails(
        statusBatch({
          from: 'terminating',
          to: 'active',
          clubExtra: { ...CLEARED, 'termination.requestedAt': serverTimestamp(), 'termination.requestedBy': OPERATOR },
        })
      );
      await assertFails(
        statusBatch({
          from: 'terminating',
          to: 'active',
          clubExtra: { ...CLEARED, 'termination.requestedBy': OPERATOR },
        })
      );
      await assertFails(
        statusBatch({
          from: 'terminating',
          to: 'active',
          clubExtra: { ...CLEARED, 'termination.requestedAt': new Date() },
        })
      );
    });

    it('refuses nulling the request on any other transition', async () => {
      const nullRequest = { 'termination.requestedAt': null, 'termination.requestedBy': null };
      const cases: Array<{ from: ClubStatus; to: ClubStatus }> = [
        { from: 'active', to: 'suspended' },
        { from: 'active', to: 'terminating' },
        { from: 'suspended', to: 'active' },
        { from: 'suspended', to: 'terminating' },
        { from: 'terminating', to: 'terminating' },
      ];
      for (const { from, to } of cases) {
        const dates = from === 'terminating' ? { effectiveAt: inDays(30), retrievalEndsAt: inDays(60) } : {};
        await seedClubIn(from, { termination: { effectiveAt: null, retrievalEndsAt: null, ...dates, ...REQUESTED } });
        await assertFails(statusBatch({ from, to, clubExtra: nullRequest, logId: `bad-${from}-${to}` }));
        // Control: the same transition leaving the request alone goes through.
        await assertSucceeds(statusBatch({ from, to, logId: `ok-${from}-${to}` }));
      }
    });
  });

  it("refuses a statusLog whose reason differs from the club's statusReason", async () => {
    await assertFails(
      statusBatch({ from: 'active', to: 'suspended', clubExtra: { statusReason: 'a' }, log: { reason: 'b' } })
    );
    // Control: the same batch with matching reasons goes through.
    await assertSucceeds(
      statusBatch({ from: 'active', to: 'suspended', clubExtra: { statusReason: 'a' }, log: { reason: 'a' } })
    );
  });

  it('refuses a statusLog missing the reason key', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, OPERATOR);
    // Club statusReason null, log without a reason key at all.
    const batch = db.batch();
    batch.update(db.doc('clubs/club-a'), {
      status: 'terminating',
      statusReason: null,
      statusChangedAt: serverTimestamp(),
      statusChangedBy: OPERATOR,
      lastStatusLogId: 'log-1',
      'termination.effectiveAt': inDays(30),
      'termination.retrievalEndsAt': inDays(60),
    });
    batch.set(db.doc('clubs/club-a/statusLog/log-1'), {
      from: 'active',
      to: 'terminating',
      by: OPERATOR,
      at: serverTimestamp(),
    });
    await assertFails(batch.commit());
    // Control: the same batch with `reason: null` goes through.
    await assertSucceeds(
      statusBatch({ from: 'active', to: 'terminating', clubExtra: { statusReason: null }, log: { reason: null } })
    );
  });

  it("refuses the platform admin changing the club's termination request", async () => {
    await assertFails(
      statusBatch({
        from: 'active',
        to: 'terminating',
        clubExtra: { 'termination.requestedBy': OPERATOR, 'termination.requestedAt': serverTimestamp() },
      })
    );
  });

  it('refuses the platform admin changing profile, legal or owner fields', async () => {
    const forbidden: Record<string, unknown>[] = [
      { name: 'Operator name' },
      { legal: { versionKey: 'terms-x_dpa-x', acceptedAt: new Date(), acceptedBy: OPERATOR } },
      { ownerEmail: COACH },
      { aiEnabled: true },
      { billing: { plan: 'x' } },
    ];
    for (const clubExtra of forbidden) {
      await assertFails(statusBatch({ from: 'active', to: 'suspended', clubExtra }));
    }
    const env = await getTestEnv();
    await assertFails(dbAs(env, OPERATOR).doc('clubs/club-a').update({ name: 'Operator name' }));
    // The same batch without the forbidden field goes through.
    await assertSucceeds(statusBatch({ from: 'active', to: 'suspended' }));
  });

  it('lets an active club admin edit the profile', async () => {
    const env = await getTestEnv();
    const club = dbAs(env, ADMIN).doc('clubs/club-a');

    await assertSucceeds(club.update({ name: 'Volley Club A' }));
    await assertSucceeds(club.update({ country: 'IT' }));
    await assertSucceeds(club.update({ locale: 'it' }));
    await assertSucceeds(club.update({ aiEnabled: true }));
    await assertSucceeds(club.update({ referenceOptOut: true }));
    // seedClub turns growth tests on by default, so the edit turns them off.
    await assertSucceeds(club.update({ growthTestsEnabled: false }));

    await assertFails(club.update({ name: 'X' }));
    await assertFails(club.update({ name: 'x'.repeat(81) }));
    await assertFails(club.update({ country: 'ita' }));
    await assertFails(club.update({ locale: 'fr' }));
    await assertFails(club.update({ aiEnabled: 'yes' }));
    // Status fields belong to the platform admin. (`status: 'active'` on an active
    // club is a no-op, so the active case uses another status; see the pending test.)
    await assertFails(club.update({ status: 'suspended' }));
    await assertFails(club.update({ statusReason: 'x' }));
    await assertFails(club.update({ legal: { versionKey: 'k', acceptedAt: new Date(), acceptedBy: ADMIN } }));
    await assertFails(club.update({ billing: { plan: 'x' } }));
    await assertFails(club.update({ createdAt: new Date() }));
  });

  it("lets a pending club's admin edit the profile; a suspended club's admin cannot", async () => {
    const env = await getTestEnv();
    await seedClubIn('pending');
    const club = dbAs(env, ADMIN).doc('clubs/club-a');
    await assertSucceeds(club.update({ name: 'Volley Club A' }));
    // A pending club's admin cannot activate their own club.
    await assertFails(club.update({ status: 'active' }));

    await seedClubIn('suspended');
    await assertFails(club.update({ name: 'Volley Club A' }));
  });

  it('lets an admin transfer ownership only to another admin member', async () => {
    const env = await getTestEnv();
    await seedClubIn('active', { admins: [ADMIN, 'admin2-a@example.com'] });
    const club = dbAs(env, ADMIN).doc('clubs/club-a');

    await assertFails(club.update({ ownerEmail: COACH }));
    await assertFails(club.update({ ownerEmail: 'nobody@example.com' }));
    await assertSucceeds(club.update({ ownerEmail: 'admin2-a@example.com' }));
  });

  it('refuses a legal update without a matching acceptance', async () => {
    const env = await getTestEnv();
    const now = new Date();
    const authTime = authTimeAgo(60);
    const a = await buildAcceptance({
      termsVersion: inForce('terms', now).version,
      dpaVersion: inForce('dpa', now).version,
      subprocessorsVersion: inForce('subprocessors', now).version,
      language: 'en',
      email: ADMIN,
      personName: 'Club Officer',
      authTime,
      userAgent: 'Mozilla/5.0 (rules test)',
    });
    const db = dbAs(env, ADMIN, { authTime });
    const club = db.doc('clubs/club-a');
    const withAcceptance = (legal: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
      const batch = db.batch();
      batch.set(db.doc(`clubs/club-a/acceptances/${a.versionKey}`), acceptanceDoc(a));
      batch.update(club, { legal, ...extra });
      return batch.commit();
    };
    const { legal } = legalUpdate(a.versionKey, ADMIN);

    // No acceptance at all.
    await assertFails(club.update({ legal }));
    // An older acceptance by the same admin, not written in this batch.
    const OLD = 'terms-2000-01-01_dpa-2000-01-01';
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`clubs/club-a/acceptances/${OLD}`).set({ versionKey: OLD, acceptedBy: ADMIN });
      await context.firestore().doc('clubs/club-a/acceptances/terms-y_dpa-y').set({ acceptedBy: COACH });
    });
    await assertFails(club.update(legalUpdate(OLD, ADMIN)));
    // Another person's older acceptance (refused as not written in this batch).
    await assertFails(club.update(legalUpdate('terms-y_dpa-y', ADMIN)));
    // With a valid acceptance, the legal field must still be the signer's, now, and nothing else.
    await assertFails(withAcceptance({ ...legal, acceptedBy: COACH }));
    await assertFails(withAcceptance({ ...legal, acceptedAt: new Date() }));
    await assertFails(withAcceptance({ ...legal, extra: 1 }));
    await assertFails(withAcceptance(legal, { name: 'Renamed in the same write' }));
    await assertFails(withAcceptance(legal, { status: 'active', statusReason: 'x' }));
    // Control: the matching batch goes through.
    await assertSucceeds(withAcceptance(legal));
  });

  it('lets a club admin request termination while active or suspended', async () => {
    const env = await getTestEnv();
    const club = dbAs(env, ADMIN).doc('clubs/club-a');
    const request = { 'termination.requestedAt': serverTimestamp(), 'termination.requestedBy': ADMIN };

    await assertFails(club.update({ ...request, 'termination.effectiveAt': inDays(30) }));
    await assertFails(club.update({ ...request, 'termination.requestedBy': COACH }));
    await assertFails(club.update({ ...request, 'termination.requestedAt': new Date() }));
    await assertSucceeds(club.update(request));

    await seedClubIn('suspended');
    await assertSucceeds(club.update(request));

    await seedClubIn('terminating');
    await assertFails(club.update(request));
  });

  it('refuses a plain member any club update', async () => {
    const env = await getTestEnv();
    const club = dbAs(env, COACH).doc('clubs/club-a');
    await assertFails(club.update({ name: 'Volley Club A' }));
    await assertFails(club.update({ 'termination.requestedAt': serverTimestamp(), 'termination.requestedBy': COACH }));
    await assertFails(club.update({ status: 'suspended' }));
  });

  it('refuses a club doc created alone (without its member and acceptance), and any client delete', async () => {
    const env = await getTestEnv();
    const authTime = authTimeAgo(60);
    const key = 'terms-2026-10-22_dpa-2026-10-22';
    const id = 'NewClubAutoId0000001';
    for (const who of ['founder@example.com', OPERATOR]) {
      const newClub = signupClubDoc({ name: 'New club', country: 'ES', locale: 'en' }, who, key);
      await assertFails(dbAs(env, who, { authTime }).doc(`clubs/${id}`).set(newClub));
    }
    await assertFails(dbAs(env, ADMIN).doc('clubs/club-a').delete());
    await assertFails(dbAs(env, OPERATOR).doc('clubs/club-a').delete());
  });

  it('lets club admins and the platform admin read the status log; members cannot; nobody edits it', async () => {
    const env = await getTestEnv();
    await assertSucceeds(statusBatch({ from: 'active', to: 'suspended' }));

    await assertSucceeds(dbAs(env, ADMIN).collection('clubs/club-a/statusLog').get());
    await assertSucceeds(dbAs(env, OPERATOR).doc('clubs/club-a/statusLog/log-1').get());
    await assertFails(dbAs(env, COACH).doc('clubs/club-a/statusLog/log-1').get());
    await assertFails(dbAs(env, 'outsider@example.com').doc('clubs/club-a/statusLog/log-1').get());

    await assertFails(dbAs(env, OPERATOR).doc('clubs/club-a/statusLog/log-1').update({ reason: 'changed' }));
    await assertFails(dbAs(env, OPERATOR).doc('clubs/club-a/statusLog/log-1').delete());
    await assertFails(dbAs(env, ADMIN).doc('clubs/club-a/statusLog/log-1').delete());
  });
});
