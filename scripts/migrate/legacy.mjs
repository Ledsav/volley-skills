// The single-club top-level collections the club-platform migration copied under
// clubs/{clubId}. They stay, denied by the rules, for a grace period after the
// migration (spec §9.6); then dropLegacy.mjs deletes them.
import { countUnder } from './firestoreTree.mjs';

export const GRACE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Never users, interestSignups, platformAdmins or clubs: those are live. */
export const DROP_COLLECTIONS = ['adminAllowlist', 'teams', 'exercises', 'trainings', 'counters',
  'skillGuide', 'physicalTestGuide', 'sectionAccess'];

/** `club`: the migrated club doc's data, or null. */
export function dropAllowed(club, now) {
  if (!club) return { ok: false, reason: 'migrated club not found: migrate first' };
  const until = club.createdAt.toMillis() + GRACE_DAYS * DAY_MS;
  if (now.getTime() < until) return { ok: false, reason: `grace period runs until ${new Date(until).toISOString()}` };
  return { ok: true };
}

/** Deletes every DROP_COLLECTIONS tree; returns the doc count deleted per collection. */
export async function dropLegacy(db, log = console.log) {
  const deleted = {};
  for (const name of DROP_COLLECTIONS) {
    deleted[name] = await countUnder(db, name);
    if (deleted[name] > 0) await db.recursiveDelete(db.collection(name));
    log(`  ${name}: ${deleted[name]} deleted`);
  }
  return deleted;
}
