// One-time: create sectionAccess/* docs, back-fill from existing admins,
// relabel user roles. Safe to re-run (idempotent set/merge).
// Usage: node scripts/migrate/2026-09-11-section-access.mjs --prod
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const isProd = process.argv.includes('--prod');
if (!isProd) { console.error('Pass --prod to run.'); process.exit(1); }

const key = JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const emails = new Set();

// existing global admins
const users = await db.collection('users').get();
let relabelled = 0;
const batch = db.batch();
for (const u of users.docs) {
  const role = u.data().role;
  if (role === 'admin') { emails.add(u.data().email); batch.update(u.ref, { role: 'superadmin' }); relabelled++; }
  else if (role === 'viewer') { batch.update(u.ref, { role: 'member' }); relabelled++; }
}

// existing team admins
const teams = await db.collection('teams').get();
for (const t of teams.docs) for (const e of (t.data().adminEmails ?? [])) emails.add(e);

const list = [...emails];
for (const section of ['exercises', 'trainings', 'guides']) {
  const data = { migratedAt: FieldValue.serverTimestamp() };
  // arrayUnion (not a bare array) so re-running never drops an email added by
  // some other means since the last run (e.g. a member granted section-only
  // access via /admin/access) — arrayUnion() throws given zero elements, so
  // only include the field when there's something to back-fill.
  if (list.length > 0) data.adminEmails = FieldValue.arrayUnion(...list);
  batch.set(db.doc(`sectionAccess/${section}`), data, { merge: true });
}

await batch.commit();
console.log(`Done. sectionAccess/* created with ${list.length} email(s); ${relabelled} user doc(s) relabelled.`);
process.exit(0);
