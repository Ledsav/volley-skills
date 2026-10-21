import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import type { ClubStatus } from '../../src/types/club';
import {
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
]);
const PAIRS = STATUSES.flatMap((from) =>
  STATUSES.filter((to) => to !== from).map((to) => ({ from, to, allowed: ALLOWED.has(`${from}>${to}`) }))
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
    await assertSucceeds(club.update({ growthTestsEnabled: true }));

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

  it('refuses creating or deleting a club doc from the client', async () => {
    const env = await getTestEnv();
    const newClub = {
      name: 'New club',
      country: 'ES',
      locale: 'en',
      ownerEmail: 'founder@example.com',
      status: 'pending',
    };
    await assertFails(dbAs(env, 'founder@example.com').doc('clubs/club-new').set(newClub));
    await assertFails(dbAs(env, OPERATOR).doc('clubs/club-new').set(newClub));
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
