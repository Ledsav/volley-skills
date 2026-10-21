// Fills in `summary`, `report`, `usageContribution` and `result` for finished matches
// that have no summary yet (seeded matches), by replaying their events through the
// app's own engine — the same path the scouting screen runs on "Finish match".
//
//   npx vite-node scripts/seed/backfillSummaries.ts      # against a running emulator
//
// Emulator-only. Also updates each team's scoutProfile/usage.

import admin from 'firebase-admin';
import { parseClubArg } from './clubArg.mjs';
import { buildFinishPayload } from '../../src/matches/finish';
import { replay } from '../../src/matches/scoutEngine';
import type { Match, MatchEvent, UsageProfile } from '../../src/types/match';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST is not a local address.');
  process.exit(1);
}
admin.initializeApp({ projectId: 'volley-skills' });
const db = admin.firestore();
const club = parseClubArg(process.argv.slice(2));

// collectionGroup spans every club: keep only this club's matches.
const finished = await db.collectionGroup('matches').where('status', '==', 'finished').get();
const pending = finished.docs
  .filter((d) => d.ref.path.startsWith(`clubs/${club}/`) && !d.data().summary).sort((a, b) => String(a.data().date).localeCompare(String(b.data().date)));
const profiles = new Map<string, UsageProfile>();
const teamRefs = new Map<string, FirebaseFirestore.DocumentReference>();

for (const doc of pending) {
  const teamRef = doc.ref.parent.parent!;
  const match = { id: doc.id, ...doc.data() } as Match;
  const events = (await doc.ref.collection('events').orderBy('order').limit(5000).get()).docs.map(
    (e) => ({ id: e.id, ...e.data() }) as MatchEvent,
  );
  teamRefs.set(teamRef.id, teamRef);
  if (!profiles.has(teamRef.id)) {
    const snap = await teamRef.collection('scoutProfile').doc('usage').get();
    profiles.set(teamRef.id, (snap.exists ? snap.data() : { players: {} }) as UsageProfile);
  }
  const payload = buildFinishPayload(match, replay(match, events), profiles.get(teamRef.id)!);
  profiles.set(teamRef.id, payload.usageProfile);
  await doc.ref.update({
    summary: payload.summary,
    report: payload.report,
    usageContribution: payload.usageContribution,
    result: payload.result,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`Summarised ${teamRef.id}/${doc.id} (${events.length} events, ${payload.result.setsUs}-${payload.result.setsThem})`);
}

for (const [teamId, profile] of profiles) {
  await teamRefs.get(teamId)!.collection('scoutProfile').doc('usage').set(profile);
}
console.log(`Done: ${pending.length} match(es) summarised.`);
process.exit(0);
