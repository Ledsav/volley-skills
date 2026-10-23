// Shared helpers for the plan-team-training scripts: argument parsing, a Firestore
// handle (production via the repo's service-account loader, or the local emulator),
// and the data root for either layout (legacy top-level, or clubs/{clubId}).
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

/** `--key value` and bare `--flag` arguments; positional args in `_`. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function projectId() {
  const rc = JSON.parse(readFileSync('.firebaserc', 'utf8'));
  return rc.projects.default;
}

/** Firestore admin handle. `--emulator` talks to the local emulator (no key needed). */
export async function openDb(args) {
  const admin = require('firebase-admin');
  if (args.emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    admin.initializeApp({ projectId: projectId() });
    return { admin, db: admin.firestore(), target: `emulator ${process.env.FIRESTORE_EMULATOR_HOST}` };
  }
  const loader = resolve('scripts/lib/serviceAccount.mjs');
  let key;
  if (existsSync(loader)) {
    const { loadServiceAccount } = await import(pathToFileURL(loader).href);
    key = await loadServiceAccount();
  } else {
    key = JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'));
  }
  admin.initializeApp({ credential: admin.credential.cert(key), projectId: key.project_id });
  return { admin, db: admin.firestore(), target: `PRODUCTION ${key.project_id}` };
}

/**
 * The parent that holds teams/exercises/trainings/counters: the database itself on the
 * legacy layout, or `clubs/{clubId}` on the multi-club layout. Refuses to guess.
 */
export async function dataRoot(db, args) {
  if (args.club) {
    const club = await db.doc(`clubs/${args.club}`).get();
    if (!club.exists) throw new Error(`clubs/${args.club} does not exist.`);
    return { root: club.ref, layout: `clubs/${args.club}` };
  }
  const legacy = await db.collection('teams').limit(1).get();
  if (legacy.empty) {
    const clubs = await db.collection('clubs').limit(10).get();
    throw new Error(
      `No top-level teams: this database uses the multi-club layout. Pass --club <id> (found: ${clubs.docs.map((d) => d.id).join(', ') || 'none'}).`,
    );
  }
  return { root: db, layout: 'legacy (top-level)' };
}

/** Lowercase, accents stripped, single spaces — for matching names typed by a coach. */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const today = () => new Date().toISOString().slice(0, 10);
