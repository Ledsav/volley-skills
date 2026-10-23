import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { DocumentData } from 'firebase/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildAcceptance } from '../../src/legal/acceptance';
import { inForce, type LegalLang } from '../../src/legal/versions';
import { acceptanceDoc, signupClubDoc, signupMemberDoc } from '../../src/signup/signupDocs';
import {
  authTimeAgo,
  dbAs,
  getTestEnv,
  OPERATOR,
  seedClub,
  seedPlatformAdmin,
  type Firestore,
} from './testEnv';

// Self sign-up (spec §6.3): one batch writes the pending club, the signer's admin
// member doc and the acceptance. Every doc comes from the app's own builders.
const FOUNDER = 'founder@example.com';
const ADMIN_A = 'admin-a@example.com';
// Club ids are Firestore auto-ids (20 letters and digits); the rules refuse any other.
const NEW_CLUB = 'NewClubAutoId0000001';
const EXISTING = 'ExistingClubAutoId01';

interface Parts {
  key: string;
  club: DocumentData;
  member: DocumentData;
  acceptance: DocumentData;
}

async function parts(
  opts: { email?: string; language?: LegalLang; authTime?: number } = {},
): Promise<Parts> {
  const now = new Date();
  const a = await buildAcceptance({
    termsVersion: inForce('terms', now).version,
    dpaVersion: inForce('dpa', now).version,
    subprocessorsVersion: inForce('subprocessors', now).version,
    language: opts.language ?? 'en',
    email: opts.email ?? FOUNDER,
    personName: 'Ada Founder',
    authTime: opts.authTime ?? authTimeAgo(60),
    userAgent: 'Mozilla/5.0 (rules test)',
  });
  return {
    key: a.versionKey,
    club: signupClubDoc(
      { name: 'New Volley Club', country: 'IT', locale: 'it' },
      opts.email ?? FOUNDER,
      a.versionKey,
    ),
    member: signupMemberDoc(NEW_CLUB, opts.email ?? FOUNDER),
    acceptance: acceptanceDoc(a),
  };
}

interface Commit {
  clubId?: string;
  memberId?: string;
  acceptanceId?: string;
  skip?: Array<'club' | 'member' | 'acceptance'>;
  /** More member docs in the same batch, each at its own email. */
  extraMembers?: DocumentData[];
}

/** The sign-up batch as the client sends it. */
function commit(db: Firestore, p: Parts, c: Commit = {}): Promise<void> {
  const clubId = c.clubId ?? NEW_CLUB;
  const email = String(p.member.email);
  const skip = new Set(c.skip ?? []);
  const batch = db.batch();
  if (!skip.has('club')) batch.set(db.doc(`clubs/${clubId}`), p.club);
  if (!skip.has('member'))
    batch.set(db.doc(`clubs/${clubId}/members/${c.memberId ?? email}`), p.member);
  if (!skip.has('acceptance'))
    batch.set(db.doc(`clubs/${clubId}/acceptances/${c.acceptanceId ?? p.key}`), p.acceptance);
  for (const m of c.extraMembers ?? []) batch.set(db.doc(`clubs/${clubId}/members/${m.email}`), m);
  return batch.commit();
}

const fresh = () => ({ authTime: authTimeAgo(60) });

describe('self sign-up rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, { id: 'club-a', admins: [ADMIN_A] });
    await seedClub(env, { id: EXISTING, admins: [ADMIN_A] });
    await seedPlatformAdmin(env, OPERATOR);
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('a valid sign-up batch creates a pending club, its admin and the acceptance', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const db = dbAs(env, FOUNDER, { authTime: p.acceptance.authTime });
    await assertSucceeds(commit(db, p));

    const club = await assertSucceeds(db.doc(`clubs/${NEW_CLUB}`).get());
    expect(club.data()).toMatchObject({
      status: 'pending',
      ownerEmail: FOUNDER,
      legal: { versionKey: p.key },
    });
    await assertSucceeds(db.doc(`clubs/${NEW_CLUB}/members/${FOUNDER}`).get());
    await assertSucceeds(db.doc(`clubs/${NEW_CLUB}/acceptances/${p.key}`).get());
    // A second commit of the same draft is refused (club and acceptance exist).
    await assertFails(commit(db, p));
  });

  it('accepts an acceptance signed in Italian', async () => {
    const env = await getTestEnv();
    const p = await parts({ language: 'it' });
    await assertSucceeds(commit(dbAs(env, FOUNDER, { authTime: p.acceptance.authTime }), p));
  });

  it('accepts a mixed-case sign-in email (stored lowercased)', async () => {
    const env = await getTestEnv();
    const p = await parts({ email: 'Founder@Example.com' });
    await assertSucceeds(
      commit(dbAs(env, 'Founder@Example.com', { authTime: p.acceptance.authTime }), p),
    );
  });

  it('refuses a batch without the acceptance', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const db = dbAs(env, FOUNDER, fresh());
    await assertFails(commit(db, p, { skip: ['acceptance'] }));
    await assertFails(commit(db, p, { skip: ['member'] }));
    await assertFails(commit(db, p, { skip: ['member', 'acceptance'] }));
    // Member or acceptance alone, without the club.
    await assertFails(commit(db, p, { skip: ['club'] }));
    await assertFails(commit(db, p, { skip: ['club', 'acceptance'] }));
    await assertFails(commit(db, p, { skip: ['club', 'member'] }));
  });

  it('refuses an auth_time older than 15 minutes', async () => {
    const env = await getTestEnv();
    const stale = authTimeAgo(16 * 60);
    const p = await parts({ authTime: stale });
    await assertFails(commit(dbAs(env, FOUNDER, { authTime: stale }), p));
    // A token without a fresh sign-in (mock auth_time 0) is refused too.
    const p0 = await parts({ authTime: 0 });
    await assertFails(commit(dbAs(env, FOUNDER), p0));
  });

  it('refuses an acceptance whose authTime differs from the token', async () => {
    const env = await getTestEnv();
    const p = await parts({ authTime: authTimeAgo(30) });
    await assertFails(commit(dbAs(env, FOUNDER, { authTime: authTimeAgo(60) }), p));
    // A fresh-looking authTime on a stale token.
    await assertFails(commit(dbAs(env, FOUNDER, { authTime: authTimeAgo(16 * 60) }), p));
  });

  it('refuses a club whose ownerEmail is someone else', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const db = dbAs(env, FOUNDER, { authTime: p.acceptance.authTime });
    const other = 'other@example.com';
    await assertFails(commit(db, { ...p, club: { ...p.club, ownerEmail: other } }));
    // The signer cannot sign or be recorded under someone else's email either.
    await assertFails(commit(db, { ...p, acceptance: { ...p.acceptance, acceptedBy: other } }));
    await assertFails(
      commit(db, { ...p, club: { ...p.club, legal: { ...p.club.legal, acceptedBy: other } } }),
    );
    // Nor add another person as the admin (with or without their own doc id).
    const otherMember = { ...p.member, email: other, addedBy: FOUNDER };
    await assertFails(commit(db, { ...p, member: otherMember }, { memberId: other }));
    // Nor add another person next to your own admin doc in the sign-up batch.
    await assertFails(commit(db, p, { extraMembers: [otherMember] }));
    await assertFails(commit(db, p, { extraMembers: [{ ...otherMember, role: 'member' }] }));
  });

  it('refuses status active, or aiEnabled true', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const db = dbAs(env, FOUNDER, { authTime: p.acceptance.authTime });
    const bad: DocumentData[] = [
      { status: 'active' },
      { aiEnabled: true },
      { growthTestsEnabled: true },
      { referenceOptOut: true },
      { statusReason: 'x' },
      { statusChangedBy: FOUNDER },
      { lastStatusLogId: 'log-1' },
      { billing: { plan: 'free' } },
      { createdAt: new Date() },
      { termination: { ...p.club.termination, effectiveAt: new Date() } },
      { name: 'X' },
      { country: 'ita' },
      { locale: 'fr' },
      { legal: { ...p.club.legal, acceptedAt: new Date() } },
    ];
    for (const change of bad) {
      await assertFails(commit(db, { ...p, club: { ...p.club, ...change } }));
    }
    // A plain member role, or a client addedAt, on the member doc.
    await assertFails(commit(db, { ...p, member: { ...p.member, role: 'member' } }));
    await assertFails(commit(db, { ...p, member: { ...p.member, addedAt: new Date() } }));
    await assertFails(commit(db, { ...p, member: { ...p.member, clubId: 'club-a' } }));
  });

  it('refuses an existing club id', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const db = dbAs(env, FOUNDER, { authTime: p.acceptance.authTime });
    await assertFails(
      commit(db, { ...p, member: { ...p.member, clubId: EXISTING } }, { clubId: EXISTING }),
    );
  });

  it('refuses a hand-picked club id', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const db = dbAs(env, FOUNDER, { authTime: p.acceptance.authTime });
    for (const id of [
      'my-volley-club',
      'NewClubAutoId000001',
      'NewClubAutoId00000012',
      'NewClub_AutoId000001',
    ]) {
      await assertFails(commit(db, { ...p, member: { ...p.member, clubId: id } }, { clubId: id }));
    }
  });

  it('refuses an admin re-running the sign-up batch over their own suspended or pending club', async () => {
    const env = await getTestEnv();
    for (const [id, status] of [
      ['OwnSuspendedClubId01', 'suspended'],
      ['OwnPendingClubIdX001', 'pending'],
    ] as const) {
      await seedClub(env, { id, status, admins: [FOUNDER], ownerEmail: FOUNDER });
      const p = await parts();
      const db = dbAs(env, FOUNDER, { authTime: p.acceptance.authTime });
      await assertFails(commit(db, { ...p, member: { ...p.member, clubId: id } }, { clubId: id }));
    }
  });

  it('refuses an acceptance created from a google.com sign-in', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const authTime = p.acceptance.authTime;
    await assertFails(commit(dbAs(env, FOUNDER, { authTime, provider: 'google.com' }), p));
    await assertFails(commit(dbAs(env, FOUNDER, { authTime, provider: 'custom' }), p));
    // Control: the same batch from an email-link sign-in.
    await assertSucceeds(commit(dbAs(env, FOUNDER, { authTime }), p));
  });

  it('refuses adding yourself to an existing club through the sign-up branch', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const db = dbAs(env, FOUNDER, { authTime: p.acceptance.authTime });
    const member = signupMemberDoc('club-a', FOUNDER);
    await assertFails(db.doc(`clubs/club-a/members/${FOUNDER}`).set(member));
    // Also with an acceptance and without touching the club doc.
    await assertFails(commit(db, { ...p, member }, { clubId: 'club-a', skip: ['club'] }));
    // An existing pending club named as owned by you does not open the branch either.
    await seedClub(env, {
      id: 'club-p',
      status: 'pending',
      admins: [ADMIN_A],
      ownerEmail: FOUNDER,
    });
    await assertFails(
      db.doc(`clubs/club-p/members/${FOUNDER}`).set(signupMemberDoc('club-p', FOUNDER)),
    );
  });

  it('refuses extra keys on the club, member or acceptance', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const db = dbAs(env, FOUNDER, { authTime: p.acceptance.authTime });
    await assertFails(commit(db, { ...p, club: { ...p.club, extra: 1 } }));
    await assertFails(
      commit(db, { ...p, club: { ...p.club, legal: { ...p.club.legal, extra: 1 } } }),
    );
    await assertFails(
      commit(db, {
        ...p,
        club: { ...p.club, termination: { ...p.club.termination, extra: null } },
      }),
    );
    await assertFails(commit(db, { ...p, member: { ...p.member, extra: 1 } }));
    await assertFails(commit(db, { ...p, acceptance: { ...p.acceptance, extra: 1 } }));
    // Missing keys are refused too.
    const noBilling = { ...p.club };
    delete noBilling.billing;
    await assertFails(commit(db, { ...p, club: noBilling }));
    const noUserAgent = { ...p.acceptance };
    delete noUserAgent.userAgent;
    await assertFails(commit(db, { ...p, acceptance: noUserAgent }));
  });

  it('refuses a malformed acceptance', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const db = dbAs(env, FOUNDER, { authTime: p.acceptance.authTime });
    const bad: DocumentData[] = [
      { acceptedByName: '' },
      { acceptedByName: 'x'.repeat(101) },
      { userAgent: 'x'.repeat(301) },
      { authorityConfirmed: false },
      { termsSha256: 'A'.repeat(64) },
      { dpaSha256: 'a'.repeat(63) },
      { clausesSha256: 'not-a-hash' },
      { specificClauses: 'T2' },
      { specificClauses: [] },
      { specificClauses: Array.from({ length: 51 }, (_, i) => `T${i}`) },
      { acceptedAt: new Date() },
      { subprocessorsVersion: 1 },
    ];
    for (const change of bad) {
      await assertFails(commit(db, { ...p, acceptance: { ...p.acceptance, ...change } }));
    }
  });

  it('refuses the platform admin signing up', async () => {
    const env = await getTestEnv();
    const p = await parts({ email: OPERATOR });
    await assertFails(commit(dbAs(env, OPERATOR, { authTime: p.acceptance.authTime }), p));
  });

  it('refuses a versionKey that does not match the versions', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const db = dbAs(env, FOUNDER, { authTime: p.acceptance.authTime });
    const wrong = 'terms-2000-01-01_dpa-2000-01-01';
    // Doc id, field and club all say `wrong`, but the versions say otherwise.
    await assertFails(
      commit(db, {
        ...p,
        key: wrong,
        club: { ...p.club, legal: { ...p.club.legal, versionKey: wrong } },
        acceptance: { ...p.acceptance, versionKey: wrong },
      }),
    );
    // Doc id differs from the record's versionKey.
    await assertFails(
      commit(
        db,
        { ...p, club: { ...p.club, legal: { ...p.club.legal, versionKey: wrong } } },
        { acceptanceId: wrong },
      ),
    );
    // The club points at another version than the acceptance written.
    await assertFails(
      commit(db, { ...p, club: { ...p.club, legal: { ...p.club.legal, versionKey: wrong } } }),
    );
  });

  it('refuses versions that are not ISO dates', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const db = dbAs(env, FOUNDER, { authTime: p.acceptance.authTime });
    // Each record is self-consistent (doc id == versionKey == the versions, club pointing at it).
    const variants: Array<[string, string]> = [
      ['v1', 'v1'],
      // The `_dpa-` ambiguity: terms 'a_dpa-b' + dpa 'c' and terms 'a' + dpa 'b_dpa-c' share a key.
      ['2026-10-22_dpa-2026-10-22', '2026-10-22'],
    ];
    for (const [termsVersion, dpaVersion] of variants) {
      const key = `terms-${termsVersion}_dpa-${dpaVersion}`;
      await assertFails(
        commit(db, {
          ...p,
          key,
          club: { ...p.club, legal: { ...p.club.legal, versionKey: key } },
          acceptance: { ...p.acceptance, versionKey: key, termsVersion, dpaVersion },
        }),
      );
    }
    await assertFails(
      commit(db, { ...p, acceptance: { ...p.acceptance, subprocessorsVersion: 'latest' } }),
    );
  });

  it('refuses an unsupported language', async () => {
    const env = await getTestEnv();
    const p = await parts();
    const db = dbAs(env, FOUNDER, { authTime: p.acceptance.authTime });
    await assertFails(commit(db, { ...p, acceptance: { ...p.acceptance, language: 'pt' } }));
  });
});
