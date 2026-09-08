#!/usr/bin/env node
// One-time migration seeder (app design spec §9).
//
//   node scripts/seed/seed.mjs [--emulator | --prod] [options]
//
// Targets
//   --emulator   (default) write to the local Firestore emulator. No credentials.
//                Requires the emulator to be running: `npm run emulator`.
//   --prod       write to the live project. Requires ./serviceAccountKey.json
//                (gitignored), plus --admin <email> and --yes. Refuses to run if
//                the `teams` collection already has documents unless --force.
//
// Options
//   --file <path>    workbook path (default: reference/VCB_U17_PlayerCards_2026-27.xlsx)
//   --admin <email>  email placed in the seeded team's adminEmails so someone can
//                    sign in and see the data. Emulator default: coach@example.com
//                    (or $SEED_ADMIN_EMAIL). Required for --prod.
//   --reset          (emulator only) delete the seeded team + skillGuide/config first.
//   --force          (prod only) allow seeding even though `teams` is non-empty.
//   --yes            (prod only) skip the interactive confirmation.
//
// Logs counts only — never player/guardian field values.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseWorkbook, SKILL_KEYS } from './parseWorkbook.mjs';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const PROJECT_ID = 'volley-skills';
const DEFAULT_FILE = 'reference/VCB_U17_PlayerCards_2026-27.xlsx';
const KEY_PATH = 'serviceAccountKey.json';

function parseArgs(argv) {
  const args = { target: 'emulator', file: DEFAULT_FILE, admin: '', reset: false, force: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prod') args.target = 'prod';
    else if (a === '--emulator') args.target = 'emulator';
    else if (a === '--file') args.file = argv[++i];
    else if (a === '--admin') args.admin = argv[++i];
    else if (a === '--reset') args.reset = true;
    else if (a === '--force') args.force = true;
    else if (a === '--yes' || a === '-y') args.yes = true;
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function computeAvgScore(skills) {
  const scores = SKILL_KEYS.map((k) => skills[k].score).filter((s) => s !== null && s !== undefined);
  if (scores.length === 0) return null;
  return scores.reduce((t, s) => t + s, 0) / scores.length;
}

function computeLevel(avg) {
  if (avg === null) return null;
  if (avg < 4) return 'Beginner';
  if (avg < 6) return 'Developing';
  if (avg < 8) return 'Advanced';
  return 'Elite';
}

async function confirm(question) {
  process.stdout.write(question);
  return new Promise((resolve) => {
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (d) => {
      process.stdin.pause();
      resolve(d.trim());
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(args.file)) {
    console.error(`Workbook not found: ${args.file}`);
    console.error('The migration workbook is gitignored — place it at that path (see scripts/seed/README.md).');
    process.exit(1);
  }

  // --- Firebase Admin init -------------------------------------------------
  if (args.target === 'prod') {
    if (!existsSync(KEY_PATH)) {
      console.error(`--prod requires ${KEY_PATH} (gitignored service-account key). See scripts/seed/README.md.`);
      process.exit(1);
    }
    if (!args.admin) {
      console.error('--prod requires --admin <email> (the team admin who will sign in).');
      process.exit(1);
    }
    const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(key), projectId: key.project_id });
    console.log(`Target: PROD project "${key.project_id}"`);
  } else {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    args.admin = args.admin || process.env.SEED_ADMIN_EMAIL || 'coach@example.com';
    admin.initializeApp({ projectId: PROJECT_ID });
    console.log(`Target: EMULATOR at ${process.env.FIRESTORE_EMULATOR_HOST} (project "${PROJECT_ID}")`);
  }

  const db = admin.firestore();
  const { FieldValue } = admin.firestore;

  // --- Parse -------------------------------------------------------------
  const { team, skillGuide, players } = await parseWorkbook(args.file);
  console.log(`Parsed: 1 team, ${skillGuide.length} skill-guide entries, ${players.length} players.`);
  if (players.length === 0) {
    console.error('No players parsed — aborting.');
    process.exit(1);
  }

  // --- Guards ----------------------------------------------------------
  const teamsSnap = await db.collection('teams').limit(1).get();
  if (!teamsSnap.empty) {
    if (args.target === 'prod' && !args.force) {
      console.error('`teams` already has documents. Refusing to seed prod without --force.');
      process.exit(1);
    }
    if (args.target === 'emulator' && !args.reset) {
      console.warn('Note: `teams` already has documents in the emulator. Adding another team. Use --reset to clear the previous seed.');
    }
  }

  if (args.target === 'prod' && !args.yes) {
    const answer = await confirm(
      `\nAbout to write 1 team + skillGuide/config + ${players.length} players to PROD, admin = ${args.admin}.\nType "seed" to proceed: `
    );
    if (answer !== 'seed') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // --- Optional reset (emulator) ------------------------------------------
  if (args.reset && args.target === 'emulator') {
    const existing = await db.collection('teams').where('createdBy', '==', 'seed-script').get();
    for (const teamDoc of existing.docs) {
      const kids = await teamDoc.ref.collection('players').get();
      const batch = db.batch();
      kids.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(teamDoc.ref);
      await batch.commit();
    }
    await db.doc('skillGuide/config').delete().catch(() => {});
    const allow = await db.collection('adminAllowlist').where('addedBy', '==', 'seed-script').get();
    await Promise.all(allow.docs.map((d) => d.ref.delete()));
    console.log(
      `Reset: removed ${existing.size} previously-seeded team(s), skillGuide/config, ${allow.size} adminAllowlist entr${allow.size === 1 ? 'y' : 'ies'}.`
    );
  }

  // --- Write ---------------------------------------------------------
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  const teamRef = db.collection('teams').doc();
  batch.set(teamRef, {
    ...team,
    adminEmails: [args.admin],
    createdBy: 'seed-script',
    createdAt: now,
  });

  // adminAllowlist gates who may become a global admin (spec §6). Without an
  // entry, the admin email would resolve to role 'viewer' on first sign-in and
  // couldn't create teams or edit the guide. In prod this doc is normally added
  // via the Firebase console; seeding it here keeps the imported team usable.
  batch.set(db.doc(`adminAllowlist/${args.admin}`), { addedBy: 'seed-script', addedAt: now });

  batch.set(db.doc('skillGuide/config'), {
    skills: skillGuide,
    updatedBy: 'seed-script',
    updatedAt: now,
  });

  for (const p of players) {
    const avgScore = computeAvgScore(p.skills);
    batch.set(teamRef.collection('players').doc(), {
      number: p.number,
      fullName: p.fullName,
      dob: p.dob,
      nationality: p.nationality,
      licenseNumber: p.licenseNumber,
      position: p.position,
      playerPhone: p.playerPhone,
      guardians: p.guardians,
      viewerEmails: [],
      teamName: team.name,
      ageGroup: team.ageGroup,
      season: team.season,
      skills: p.skills,
      avgScore,
      level: computeLevel(avgScore),
      developmentPlan: p.developmentPlan,
      consent: { given: false, date: null, confirmedBy: null },
      createdBy: 'seed-script',
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();

  console.log(
    `\nDone. Wrote team ${teamRef.id}, skillGuide/config, adminAllowlist/${args.admin}, and ${players.length} players.` +
      `\nSign in as ${args.admin} to manage this team.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
