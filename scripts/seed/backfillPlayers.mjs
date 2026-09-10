#!/usr/bin/env node
// One-time patch for player docs created before later features shipped.
//
//   node scripts/seed/backfillPlayers.mjs [--emulator | --prod] [--yes]
//
// Per player doc, only when the field is missing:
//   - positionCategory : derived from the legacy free-text `position`, else 'TBD'
//   - starting          : false
//   - skills.block      : from scripts/seed/skillsSnapshot.json by fullName,
//                         else { score: 5, notes: '', priority: false }
// When skills.block is added, avgScore + level are recomputed.
// Also appends the Block entry to skillGuide/config if the doc exists and lacks it.
//
// Never rewrites the other 8 skills, `number`, or `position`. Skips docs that
// already have everything. Dry-run unless --yes. Logs counts only.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { BLOCK_GUIDE_DEFAULT, toPositionCategory } from './parseWorkbook.mjs';
import { computeAvgScore, computeLevel } from './skillMath.mjs';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const PROJECT_ID = 'volley-skills';
const KEY_PATH = 'serviceAccountKey.json';
const SNAPSHOT_PATH = 'scripts/seed/skillsSnapshot.json';
const BLOCK_DEFAULT = 5;

function parseArgs(argv) {
  const args = { target: 'emulator', yes: false };
  for (const a of argv) {
    if (a === '--prod') args.target = 'prod';
    else if (a === '--emulator') args.target = 'emulator';
    else if (a === '--yes' || a === '-y') args.yes = true;
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.target === 'prod') {
    if (!existsSync(KEY_PATH)) {
      console.error(`--prod requires ${KEY_PATH} (gitignored service-account key).`);
      process.exit(1);
    }
    const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(key), projectId: key.project_id });
    console.log(`Target: PROD project "${key.project_id}"`);
  } else {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    admin.initializeApp({ projectId: PROJECT_ID });
    console.log(`Target: EMULATOR at ${process.env.FIRESTORE_EMULATOR_HOST}`);
  }

  const snapshot = existsSync(SNAPSHOT_PATH) ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) : {};

  const { FieldPath, FieldValue } = admin.firestore;
  const db = admin.firestore();
  const players = await db.collectionGroup('players').get();

  let scanned = 0;
  let toPatch = 0;
  let junkCleaned = 0;
  const batch = db.batch();

  players.forEach((doc) => {
    scanned += 1;
    const data = doc.data();
    const patch = {};

    if (data.positionCategory === undefined) patch.positionCategory = toPositionCategory(data.position ?? '');
    if (data.starting === undefined) patch.starting = false;

    if (data.skills && data.skills.block === undefined) {
      // A wrongly-written literal "skills.block" top-level field may hold the value.
      const junk = data['skills.block'];
      const snapScore = snapshot[data.fullName]?.block;
      const score =
        typeof junk?.score === 'number'
          ? junk.score
          : typeof snapScore === 'number'
            ? snapScore
            : BLOCK_DEFAULT;
      // Nested map + merge:true deep-merges `block` into the real `skills` map.
      patch.skills = { block: { score, notes: '', priority: false } };
      const avg = computeAvgScore({ ...data.skills, block: { score, notes: '', priority: false } });
      patch.avgScore = avg;
      patch.level = computeLevel(avg);
    }

    if (Object.keys(patch).length > 0) {
      toPatch += 1;
      batch.set(doc.ref, patch, { merge: true });
    }

    // Remove the bogus top-level field left by the earlier dotted-key write.
    if (data['skills.block'] !== undefined) {
      junkCleaned += 1;
      batch.update(doc.ref, new FieldPath('skills.block'), FieldValue.delete());
    }
  });

  // skillGuide/config: add the Block entry if the doc exists and lacks it.
  const guideRef = db.doc('skillGuide/config');
  const guideDoc = await guideRef.get();
  let guidePatched = false;
  if (guideDoc.exists) {
    const skills = guideDoc.data().skills ?? [];
    if (!skills.some((s) => s.key === 'block')) {
      const at = skills.findIndex((s) => s.key === 'attack');
      const next = [...skills];
      next.splice(at === -1 ? next.length : at + 1, 0, BLOCK_GUIDE_DEFAULT);
      batch.set(guideRef, { skills: next }, { merge: true });
      guidePatched = true;
    }
  }

  console.log(
    `Scanned ${scanned} player docs; ${toPatch} need a patch, ${junkCleaned} carry a stray "skills.block" field to remove.` +
      ` skillGuide/config: ${guidePatched ? 'Block entry added' : 'no change'}.`
  );

  if (toPatch === 0 && junkCleaned === 0 && !guidePatched) {
    console.log('Nothing to do.');
    return;
  }
  if (!args.yes) {
    console.log('Dry run — re-run with --yes to write.');
    return;
  }

  await batch.commit();
  console.log(`Patched ${toPatch} player docs (${junkCleaned} junk field(s) removed)${guidePatched ? ' + skillGuide/config' : ''}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
