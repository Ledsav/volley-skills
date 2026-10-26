// The club-platform migration's I/O core (spec §9): read the legacy tree from
// `source`, plan, write under clubs/{clubId} in `target`, then verify counts.
// Source and target are the same db in production; in a rehearsal the source is
// production (read-only) and the target the local emulator. Logs ids and counts only.
import { FieldValue } from 'firebase-admin/firestore';
import { LEGACY_COLLECTIONS, planMigration } from './clubPlatformPlan.mjs';
import { countUnder, readTree, writeAll } from './firestoreTree.mjs';

export async function runMigration({ source, target, options, resume = false, dryRun = false, log = console.log }) {
  const clubPath = `clubs/${options.clubId}`;
  // A dry run only reads the source; `target` may be null (no emulator needed).
  if (!dryRun && !resume && (await target.doc(clubPath).get()).exists) {
    throw new Error(`${clubPath} already exists; pass --resume to continue a stopped run`);
  }

  const legacy = await readTree(source, LEGACY_COLLECTIONS);
  const plan = planMigration(legacy, { ...options, now: FieldValue.serverTimestamp() });
  log(`Read ${legacy.length} legacy docs. Plan for ${clubPath} ("${plan.club.data.name}"):`);
  for (const [group, n] of Object.entries(plan.expected)) log(`  ${group}: ${n}`);
  log(`  estimated writes: ${plan.writes.length + 1}`);
  // Spark allows 50,000 reads and 20,000 writes a day, shared with everyone using the app.
  log(`  reads this pass: ~${legacy.length} (the verification after writing adds a few per team and match)`);
  if (dryRun) return { plan, written: 0, skipped: 0, counts: {}, ok: true };

  const club = await writeAll(target, [plan.club], { resume });
  const rest = await writeAll(target, plan.writes, { resume, log });
  const written = club.written + rest.written;
  const skipped = club.skipped + rest.skipped;

  // ≥, not ==: on a resume the club may already hold docs created since.
  const counts = {};
  let ok = true;
  log('Verify (group expected actual):');
  for (const [group, expected] of Object.entries(plan.expected)) {
    counts[group] = await countUnder(target, `${clubPath}/${group}`);
    if (counts[group] < expected) ok = false;
    log(`  ${group} ${expected} ${counts[group]}${counts[group] < expected ? '  <-- MISSING' : ''}`);
  }
  log(`${written} written, ${skipped} skipped. ${ok ? 'OK' : 'COUNTS DO NOT MATCH'}`);
  return { plan, written, skipped, counts, ok };
}
