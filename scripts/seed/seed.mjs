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
//                `clubs/<club>` already exists unless --force.
//
// Options
//   --file <path>    workbook path (default: reference/VCB_U17_PlayerCards_2026-27.xlsx)
//   --admin <email>  club admin + owner (and the team's adminEmails) so someone can
//                    sign in and see the data; also made a platform admin. Emulator default: coach@example.com
//                    (or $SEED_ADMIN_EMAIL). Required for --prod.
//   --club <id>      club the data goes under (default: demo; REQUIRED with --prod) -> clubs/<id>/...
//   --reset          (emulator only) delete the whole club (clubs/<club>/**) first.
//   --force          (prod only) allow seeding even though top-level `teams` is non-empty
//                    (pre-migration) or `clubs/<club>` exists. On an existing club only the
//                    team data is added: the club, member and sectionAccess docs are untouched.
//   --yes            (prod only) skip the interactive confirmation.
//
// Logs counts only — never player/guardian field values.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseWorkbook, SKILL_KEYS } from './parseWorkbook.mjs';
import { assertProdClub, clubRoot, parseClubArg, writeClub } from './clubArg.mjs';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const PROJECT_ID = 'volley-skills';
const DEFAULT_FILE = 'reference/VCB_U17_PlayerCards_2026-27.xlsx';
const KEY_PATH = 'serviceAccountKey.json';

function parseArgs(argv) {
  const args = { target: 'emulator', file: DEFAULT_FILE, admin: '', club: 'demo', reset: false, force: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prod') args.target = 'prod';
    else if (a === '--emulator') args.target = 'emulator';
    else if (a === '--file') args.file = argv[++i];
    else if (a === '--admin') args.admin = argv[++i];
    else if (a === '--club') args.club = parseClubArg(['--club', argv[++i]]);
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
  try {
    assertProdClub(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

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

  args.admin = args.admin.trim().toLowerCase();
  const db = admin.firestore();
  const { FieldValue } = admin.firestore;
  const root = clubRoot(db, args.club);

  // --- Parse -------------------------------------------------------------
  const { team, skillGuide, players } = await parseWorkbook(args.file);
  console.log(`Parsed: 1 team, ${skillGuide.length} skill-guide entries, ${players.length} players.`);
  if (players.length === 0) {
    console.error('No players parsed — aborting.');
    process.exit(1);
  }

  // Overlay the live-roster snapshot (scripts/seed/skillsSnapshot.json, keyed by
  // fullName) so a fresh seed reproduces production's scores instead of the
  // mostly-blank workbook. Skills absent from the snapshot keep the parsed value.
  const SNAPSHOT_PATH = 'scripts/seed/skillsSnapshot.json';
  const snapshot = existsSync(SNAPSHOT_PATH) ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) : {};
  let overlaid = 0;
  for (const p of players) {
    const scores = snapshot[p.fullName];
    if (!scores) continue;
    overlaid += 1;
    for (const k of SKILL_KEYS) {
      if (scores[k] !== undefined) p.skills[k] = { ...p.skills[k], score: scores[k] };
    }
  }
  console.log(`Applied skill snapshot to ${overlaid}/${players.length} players.`);

  // --- Guards ----------------------------------------------------------
  if (args.target === 'prod' && !args.force) {
    // Prod is not migrated to clubs yet: refuse while the old top-level model has data.
    const legacy = await db.collection('teams').limit(1).get();
    if (!legacy.empty) {
      console.error('Top-level `teams` already has documents (prod not migrated yet). Refusing to seed prod without --force.');
      process.exit(1);
    }
  }
  const clubSnap = await root.get();
  if (clubSnap.exists) {
    if (args.target === 'prod' && !args.force) {
      console.error(`clubs/${args.club} already exists. Refusing to seed prod without --force.`);
      process.exit(1);
    }
    if (args.target === 'emulator' && !args.reset) {
      console.warn(`Note: clubs/${args.club} already exists in the emulator. Adding another team. Use --reset to clear the previous seed.`);
    }
  }

  if (args.target === 'prod' && !args.yes) {
    const answer = await confirm(
      `\nAbout to write club ${args.club} + 1 team + config/skillGuide + ${players.length} players to PROD, admin = ${args.admin}.\nType "seed" to proceed: `
    );
    if (answer !== 'seed') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // --- Optional reset (emulator) ------------------------------------------
  if (args.reset && args.target === 'emulator') {
    await db.recursiveDelete(root);
    console.log(`Reset: removed clubs/${args.club} and everything under it.`);
  }

  // --- Write ---------------------------------------------------------
  const now = FieldValue.serverTimestamp();

  // Club doc + members + sectionAccess (admin owns the club and every section).
  // --force on an existing prod club: never rewrite the club, member or sectionAccess docs.
  const keepClub = args.target === 'prod' && clubSnap.exists;
  if (!keepClub) {
    await writeClub(db, {
      id: args.club,
      name: args.club === 'demo' ? 'Volley Demo' : args.club,
      status: 'active',
      admins: [args.admin],
    });
  }
  const batch = db.batch();

  // platformAdmins gates the operator console; seeding it keeps the admin able
  // to open /platform locally. Emulator only: in prod the operator gets it via migration.
  if (args.target === 'emulator') {
    batch.set(db.doc(`platformAdmins/${args.admin}`), { addedBy: 'seed-script', addedAt: now });
  }

  const teamRef = root.collection('teams').doc();
  batch.set(teamRef, {
    ...team,
    adminEmails: [args.admin],
    createdBy: 'seed-script',
    createdAt: now,
  });

  batch.set(root.collection('config').doc('skillGuide'), {
    skills: skillGuide,
    updatedBy: 'seed-script',
    updatedAt: now,
  });

  for (const p of players) {
    const avgScore = computeAvgScore(p.skills);
    batch.set(teamRef.collection('players').doc(), {
      // Real shirt numbers aren't known yet — seed 0 ("unset"); a coach assigns
      // them per player in the app. The field/concept still exists.
      number: 0,
      fullName: p.fullName,
      dob: p.dob,
      nationality: p.nationality,
      licenseNumber: p.licenseNumber,
      positionCategory: p.positionCategory ?? 'TBD',
      shirtSize: '',
      starting: false,
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
    `\nDone. ${keepClub ? `Kept existing clubs/${args.club} untouched; added` : `Wrote clubs/${args.club} (+ members, sectionAccess/{exercises,trainings,guides})${args.target === 'emulator' ? `, platformAdmins/${args.admin}` : ''},`} ` +
      `team ${teamRef.id}, config/skillGuide and ${players.length} players.` +
      `\nSign in as ${args.admin} to manage this team.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
