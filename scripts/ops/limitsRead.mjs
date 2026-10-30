// Read side of the size-cap check (checkLimits.mjs): every capped club document, read only.
// Walks clubs/{clubId} by known collections (one billed read per document, one for an empty
// query) instead of a generic walk, so match events, members and the legacy top-level data are
// never read. tests/rules/limitsRead.rules.test.mjs runs it against the emulator.

/** Club-level collections with size caps. */
export const CLUB_COLLECTIONS = ['teams', 'exercises', 'trainings', 'config', 'sectionAccess'];
/** Collections under each team with size caps (match events are not read: see the README). */
export const TEAM_COLLECTIONS = ['players', 'calendar', 'matches', 'awards', 'scoutProfile'];

/**
 * `{ docs: [{ path, data }], reads }` for every capped document of every club (or of `clubIds`).
 * Stops before spending more than `maxReads` (Spark's daily reads are shared with the live app).
 */
export async function readForLimits(db, { maxReads = Infinity, clubIds = null } = {}) {
  const docs = [];
  let reads = 0;
  const spend = (n) => {
    if (reads + n > maxReads) throw new Error(`Stopped at the read budget of ${maxReads} reads (spent ${reads}); raise --max-reads on a quiet day.`);
    reads += n;
  };
  async function readCollection(ref) {
    const snap = await ref.get();
    spend(Math.max(1, snap.size));
    for (const d of snap.docs) docs.push({ path: d.ref.path, data: d.data() });
    return snap.docs;
  }
  // listDocuments() returns ids only: the club profile docs themselves are not read.
  const clubs = clubIds ?? (await db.collection('clubs').listDocuments()).map((r) => r.id);
  spend(1);
  for (const clubId of clubs) {
    const club = db.collection('clubs').doc(clubId);
    for (const name of CLUB_COLLECTIONS) {
      const found = await readCollection(club.collection(name));
      if (name !== 'teams') continue;
      for (const team of found) {
        for (const sub of TEAM_COLLECTIONS) {
          const rows = await readCollection(team.ref.collection(sub));
          if (sub !== 'players') continue;
          for (const player of rows) await readCollection(player.ref.collection('physicalTests'));
        }
      }
    }
  }
  return { docs, reads, clubs: clubs.length };
}
