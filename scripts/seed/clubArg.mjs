// Shared by every seed script: which club the data goes under.
//   --club <id>   (default: demo)  → everything lives under clubs/{id}/...

import { createRequire } from 'node:module';

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
 * Writes a club doc, its member docs (doc id = lowercased email) and the three
 * sectionAccess docs. Idempotent: set() replaces. `admins[0]` is the owner.
 * Emails are lowercased everywhere.
 */
export async function writeClub(db, { id, name, status, admins, members = [], country = 'IT', locale = 'en', aiEnabled = true, growthTestsEnabled = true }) {
  const require = createRequire(import.meta.url);
  const { FieldValue } = require('firebase-admin').firestore;
  const now = FieldValue.serverTimestamp();
  const lower = (list) => [...new Set(list.map((e) => e.trim().toLowerCase()))];
  const adminEmails = lower(admins);
  const memberEmails = lower(members).filter((e) => !adminEmails.includes(e));
  const root = clubRoot(db, id);
  const batch = db.batch();

  batch.set(root, newClubDoc({ name, country, locale, ownerEmail: adminEmails[0], status, aiEnabled, growthTestsEnabled }, now));

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

  // Rules allow only { adminEmails } on these docs (keys().hasOnly), so no metadata.
  for (const section of ['exercises', 'trainings', 'guides']) {
    batch.set(root.collection('sectionAccess').doc(section), { adminEmails });
  }

  await batch.commit();
}
