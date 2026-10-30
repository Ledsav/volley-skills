/**
 * Size caps for the text and list fields of club documents, shared by the forms (`maxLength`), the JSON
 * import validators and `firestore.rules`, which repeats the numbers literally (rules cannot import).
 * Change a value here and in the rules together; `limits.test.ts` checks that the rules still carry them.
 *
 * The values are deliberately generous, so no realistic text already stored breaks: a cap is there to stop
 * a malformed or ~1 MiB document, not to shape what coaches write. Stricter, older caps stay where they
 * are (`SCENE_LIMITS`, `DRAFT_LIMITS`, the award `CUSTOM_*_MAX`, the club name's 80).
 *
 * A rule cannot loop over a list, so a list of small maps (guardians, objectives, roster rows, …) is capped
 * by its length and by the characters of all its values together (the `*Text` totals below).
 */
export const LIMITS = {
  /** Names, titles and short labels: team, player, exercise and training names, opponent, age group, season, phone, nationality, licence. */
  shortText: 200,
  /** Free text: descriptions, notes, development-plan text, skill notes, guide text per range, test protocols. */
  longText: 10_000,
  /** RFC 5321 maximum address length. */
  email: 254,

  /** `adminEmails` on a team, `viewerEmails` on a player. */
  emailList: 100,
  /** `adminEmails` on a section-access doc (every coach of a large club may sit in one section). */
  sectionEmailList: 500,
  /** Guardians on one player. */
  guardians: 10,
  /** All of a player's guardians' text together (name, phone, email, relation). */
  guardiansText: 10_000,
  /** Objectives in one development-plan list (short-term or season). */
  objectives: 10,
  /** All text of one objectives list together. */
  objectivesText: 100_000,
  /** Steps in one training (`exercises`, `exerciseIds`). */
  trainingExercises: 50,
  /** All of a training's step values together (ids, order, minutes). */
  trainingExercisesText: 10_000,
  /** Players on a match roster (manual setup allows 14; a DataVolley import maps what the file lists). */
  matchRoster: 30,
  /** All of a match roster's values together (ids, numbers, names, roles). */
  matchRosterText: 10_000,
  /** Libero configurations on a match (setup allows 2). */
  matchLiberos: 4,
  /** Search tokens on an exercise or training (`MAX_TOKENS` in src/search/searchTokens.js). */
  searchTokens: 120,
  /** All search tokens together. */
  searchTokensText: 5_000,
  /** Entries in `config/skillGuide.skills` (the nine hardcoded skills). */
  guideSkills: 9,
  /** Score ranges per skill-guide entry (the guide ships 4; the editor never adds one). */
  guideRanges: 5,
  /** All ranges of one skill together: 5 descriptions of long text plus their min/max digits. */
  guideRangesText: 50_100,
  /** Entries in `config/physicalTestGuide.tests` (the eight test types). */
  guideTests: 8,
  /** Players in a team's scouting usage profile (`scoutProfile/usage.players`). */
  scoutProfilePlayers: 500,
  /** Award picks in a season or match award choice (the ten standard awards). */
  awardPicks: 10,
  /** Award ids in a season or match award order (10 standard + 5 custom). */
  awardOrder: 15,
  /** All award ids of the order together. */
  awardOrderText: 3_000,
  /** All custom awards' values together (5 × (id, title 40, player id, note 80)). */
  awardCustomText: 2_000,
  /** A match event: fields on one event doc (a set start has 10). */
  eventFields: 20,
  /** A match event: player ids in a set-start lineup. */
  eventLineup: 12,
  /** A match event: all lineup ids together. */
  eventLineupText: 3_000,
  /** A match event: per-set role entries. */
  eventRoles: 30,
  /** Denormalised latest physical tests on a player (one per test type). */
  latestTests: 8,
  /** A player's consent record (given, date, confirming email) as text. */
  consentText: 600,
  /** Pasted or uploaded JSON for a bulk import, checked before `JSON.parse`. */
  importText: 1_000_000,
} as const;

/** True when `value` is a string longer than `max`. */
export function tooLong(value: unknown, max: number): boolean {
  return typeof value === 'string' && value.length > max;
}
