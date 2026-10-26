// Shared by every seed script: which club the data goes under.
//   --club <id>   (default: demo)  → everything lives under clubs/{id}/...

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

/** The value after `--club`, default 'demo'. */
export function parseClubArg(argv) {
  const i = argv.indexOf('--club');
  if (i === -1) return 'demo';
  const id = argv[i + 1];
  if (!id || id.startsWith('--')) {
    console.error('--club needs a club id.');
    process.exit(2);
  }
  return id;
}

/** Throws when `--prod` is used without an explicit `--club <id>` (no silent `demo` in prod). */
export function assertProdClub(argv) {
  if (argv.includes('--prod') && !argv.includes('--club')) {
    throw new Error('--prod requires an explicit --club <id> (there is no default club in prod).');
  }
}

/** `clubs/{clubId}` as a DocumentReference (Admin SDK). */
export function clubRoot(db, clubId) {
  return db.collection('clubs').doc(clubId);
}

/**
 * A new club doc (spec §3.1) with nothing requested, accepted or billed yet.
 * `now` is the createdAt value (a serverTimestamp sentinel in scripts).
 */
export function newClubDoc({ name, country, locale, ownerEmail, status, aiEnabled, growthTestsEnabled }, now) {
  return {
    name,
    country,
    locale,
    ownerEmail,
    aiEnabled,
    referenceOptOut: false,
    growthTestsEnabled,
    createdAt: now,
    status,
    statusReason: null,
    statusChangedAt: null,
    statusChangedBy: null,
    lastStatusLogId: null,
    legal: null,
    termination: { requestedAt: null, requestedBy: null, effectiveAt: null, retrievalEndsAt: null },
    billing: null,
  };
}

/**
 * The current legal version ids from src/legal/content/versions.json: the latest entry
 * of each document (the list is ordered oldest first), plus the combined version key.
 */
export function currentLegalVersions() {
  const file = new URL('../../src/legal/content/versions.json', import.meta.url);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const last = (k) => json[k][json[k].length - 1].version;
  const termsVersion = last('terms');
  const dpaVersion = last('dpa');
  return {
    versionKey: `terms-${termsVersion}_dpa-${dpaVersion}`,
    termsVersion,
    dpaVersion,
    subprocessorsVersion: last('subprocessors'),
  };
}

/**
 * An acceptance doc (clubs/{id}/acceptances/{versionKey}) as the rules shape it, with
 * placeholder hashes and no re-auth evidence: for local seeds only. `now` is acceptedAt.
 * The rules would refuse these placeholder values from a client (empty specificClauses,
 * authTime 0, all-zero hashes); the Admin SDK seed bypasses rules. Never use it in production.
 */
export function seedAcceptance({ versionKey, termsVersion, dpaVersion, subprocessorsVersion, email, name }, now = null) {
  const zero = '0'.repeat(64);
  return {
    versionKey,
    termsVersion,
    dpaVersion,
    subprocessorsVersion,
    language: 'en',
    termsSha256: zero,
    dpaSha256: zero,
    clausesSha256: zero,
    specificClauses: [],
    acceptedBy: email,
    acceptedByName: name,
    authorityConfirmed: true,
    acceptedAt: now,
    authTime: 0,
    userAgent: 'seed-script',
  };
}

/**
 * Writes a club doc, its member docs (doc id = lowercased email) and the three
 * sectionAccess docs. Idempotent: set() replaces. `admins[0]` is the owner.
 * Emails are lowercased everywhere. `ownerEmail` overrides the owner (default `admins[0]`).
 */
export async function writeClub(db, { id, name, status, admins, members = [], country = 'IT', locale = 'en', aiEnabled = true, growthTestsEnabled = true, ownerEmail, accepted }) {
  const require = createRequire(import.meta.url);
  const { FieldValue } = require('firebase-admin').firestore;
  const now = FieldValue.serverTimestamp();
  const lower = (list) => [...new Set(list.map((e) => e.trim().toLowerCase()))];
  const adminEmails = lower(admins);
  const memberEmails = lower(members).filter((e) => !adminEmails.includes(e));
  const root = clubRoot(db, id);
  const batch = db.batch();

  batch.set(root, newClubDoc({ name, country, locale, ownerEmail: (ownerEmail ?? adminEmails[0]).trim().toLowerCase(), status, aiEnabled, growthTestsEnabled }, now));

  for (const [emails, role] of [[adminEmails, 'admin'], [memberEmails, 'member']]) {
    for (const email of emails) {
      batch.set(root.collection('members').doc(email), {
        email,
        clubId: id,
        role,
        addedBy: 'seed-script',
        addedAt: now,
      });
    }
  }

  // `accepted`: an email that has accepted the current legal texts (club `legal` + acceptance doc).
  // Without it the club has `legal: null` and its admins see the blocking review screen.
  if (accepted) {
    const email = accepted.trim().toLowerCase();
    const v = currentLegalVersions();
    batch.update(root, { legal: { versionKey: v.versionKey, acceptedAt: now, acceptedBy: email } });
    batch.set(root.collection('acceptances').doc(v.versionKey), seedAcceptance({ ...v, email, name: email }, now));
  }

  // Rules allow only { adminEmails } on these docs (keys().hasOnly), so no metadata.
  for (const section of ['exercises', 'trainings', 'guides']) {
    batch.set(root.collection('sectionAccess').doc(section), { adminEmails });
  }

  await batch.commit();
}
