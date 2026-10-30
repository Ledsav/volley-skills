// Size-cap report (input limits, audit L-3): measures plain `{ path, data }` docs against LIMITS, the
// caps firestore.rules enforces, so the operator can check production before the rules ship.
// Pure: no I/O. checkLimits.mjs reads the docs (limitsRead.mjs) and prints formatReport().
//
// Measurements follow the rules: a text field counts String(value) for a scalar (null is 4, as
// string(null) is 'null') and a list or map counts as Infinity (the rules refuse it); a list of
// flat maps counts the characters of all its values together (join()), a nested value is Infinity.
// The report carries only check names, caps, counts, maxima, doc paths and club ids: never a value.
import { LIMITS } from '../../src/types/limitValues.js';

const isMap = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) && !isTimestampLike(v);
const isTimestampLike = (v) => typeof v === 'object' && v !== null && typeof v.toMillis === 'function';

/** Characters of a "text" field as the rules count them; Infinity for a list or map. */
export function textLen(v) {
  if (v === undefined) return 0;
  if (typeof v === 'object' && v !== null) return Infinity;
  return String(v).length;
}

/** Items in a list or keys in a map; Infinity when the field is something else. */
export function countOf(v) {
  if (v === undefined || v === null) return 0;
  if (Array.isArray(v)) return v.length;
  if (isMap(v)) return Object.keys(v).length;
  return Infinity;
}

/** Characters of a list of scalars joined together; Infinity for a nested value or a non-list. */
export function joinLen(list) {
  if (list === undefined || list === null) return 0;
  if (!Array.isArray(list)) return Infinity;
  return list.reduce((n, v) => n + textLen(v), 0);
}

/** Characters of all values of a list of flat maps together; Infinity for a nested value or a non-list. */
export function rowsLen(list) {
  if (list === undefined || list === null) return 0;
  if (!Array.isArray(list)) return Infinity;
  let n = 0;
  for (const row of list) {
    if (!isMap(row)) return Infinity;
    for (const v of Object.values(row)) n += textLen(v);
  }
  return n;
}

/** The largest textLen of `field` over the rows of a list (0 for none). */
function longestIn(list, field) {
  if (!Array.isArray(list)) return 0;
  return Math.max(0, ...list.map((row) => (isMap(row) ? textLen(row[field]) : Infinity)));
}

/** Keys of a map outside `allowed` (a count, never the names). */
function otherKeys(m, allowed) {
  return isMap(m) ? Object.keys(m).filter((k) => !allowed.includes(k)).length : 0;
}

const texts = (d, prefix, fields, cap) => fields.map((f) => [`${prefix}.${f}`, textLen(d[f]), cap]);

function emailList(v, name, count, L) {
  return [[`${name}.count`, countOf(v), count], [`${name}.text`, joinLen(v), count * L.email]];
}

function plan(p, prefix, L) {
  const d = isMap(p) ? p : {};
  const out = [[`${prefix}.plan.generalNotes`, textLen(d.generalNotes), L.longText]];
  for (const [list, target] of [['shortTermObjectives', 'targetDate'], ['seasonObjectives', 'target']]) {
    const l = d[list];
    out.push(
      [`${prefix}.plan.${list}.count`, countOf(l), L.objectives],
      [`${prefix}.plan.${list}.text`, rowsLen(l), L.objectivesText],
      // Per-field caps the forms apply (the rules cap the list total).
      [`${prefix}.plan.objective.longestText`, Math.max(longestIn(l, 'objective'), longestIn(l, 'coachComment')), L.longText],
      [`${prefix}.plan.objective.longestTarget`, longestIn(l, target), L.shortText],
    );
  }
  return out;
}

function awards(a, prefix, L) {
  const d = isMap(a) ? a : {};
  return [
    [`${prefix}.picks.count`, countOf(d.picks), L.awardPicks],
    [`${prefix}.custom.count`, countOf(d.custom), L.awardCustom],
    [`${prefix}.custom.text`, rowsLen(d.custom), L.awardCustomText],
    [`${prefix}.order.count`, countOf(d.order), L.awardOrder],
    [`${prefix}.order.text`, joinLen(d.order), L.awardOrderText],
  ];
}

function skillGuide(d, L) {
  const skills = Array.isArray(d.skills) ? d.skills : [];
  const entries = skills.map((e) => (isMap(e) ? e : {}));
  const max = (f) => Math.max(0, ...entries.map(f));
  return [
    ['skillGuide.otherKeys', otherKeys(d, ['skills', 'updatedBy', 'updatedAt']), 0],
    ['skillGuide.skills.count', Array.isArray(d.skills) ? d.skills.length : Infinity, L.guideSkills],
    ['skillGuide.entry.wrongKeys', skills.filter((e) => !isMap(e) || Object.keys(e).sort().join() !== 'howToEvaluate,key,label,ranges').length, 0],
    ['skillGuide.entry.key', max((e) => textLen(e.key)), L.shortText],
    ['skillGuide.entry.label', max((e) => textLen(e.label)), L.shortText],
    ['skillGuide.entry.howToEvaluate', max((e) => textLen(e.howToEvaluate)), L.longText],
    ['skillGuide.entry.ranges.count', max((e) => (Array.isArray(e.ranges) ? e.ranges.length : Infinity)), L.guideRanges],
    ['skillGuide.entry.ranges.text', max((e) => rowsLen(e.ranges)), L.guideRangesText],
    ['skillGuide.range.description', max((e) => longestIn(e.ranges, 'description')), L.longText],
    ['skillGuide.updatedBy', textLen(d.updatedBy), L.email],
  ];
}

function testGuide(d, L) {
  const tests = Array.isArray(d.tests) ? d.tests : [];
  const entries = tests.map((e) => (isMap(e) ? e : {}));
  const max = (f) => Math.max(0, ...entries.map(f));
  return [
    ['physicalTestGuide.otherKeys', otherKeys(d, ['tests', 'updatedBy', 'updatedAt']), 0],
    ['physicalTestGuide.tests.count', Array.isArray(d.tests) ? d.tests.length : Infinity, L.guideTests],
    ['physicalTestGuide.entry.wrongKeys', tests.filter((e) => !isMap(e) || Object.keys(e).sort().join() !== 'key,label,protocol').length, 0],
    ['physicalTestGuide.entry.key', max((e) => textLen(e.key)), L.shortText],
    ['physicalTestGuide.entry.label', max((e) => textLen(e.label)), L.shortText],
    ['physicalTestGuide.entry.protocol', max((e) => textLen(e.protocol)), L.longText],
    ['physicalTestGuide.updatedBy', textLen(d.updatedBy), L.email],
  ];
}

/** [pattern, checks(data, L)] for every capped doc kind, matched on the path inside `clubs/{clubId}/`. */
const KINDS = [
  [/^teams\/[^/]+$/, (d, L) => [
    ...texts(d, 'team', ['name', 'ageGroup', 'season'], L.shortText),
    ...texts(d, 'team', ['description', 'notes'], L.longText),
    ...emailList(d.adminEmails, 'team.adminEmails', L.emailList, L),
    ...plan(d.developmentPlan, 'team', L),
  ]],
  [/^teams\/[^/]+\/players\/[^/]+$/, (d, L) => {
    const skills = isMap(d.skills) ? Object.values(d.skills) : [];
    return [
      ...texts(d, 'player', ['fullName', 'dob', 'nationality', 'licenseNumber', 'playerPhone', 'teamName', 'ageGroup', 'season'], L.shortText),
      ...emailList(d.viewerEmails, 'player.viewerEmails', L.emailList, L),
      ['player.guardians.count', countOf(d.guardians), L.guardians],
      ['player.guardians.text', rowsLen(d.guardians), L.guardiansText],
      ['player.guardian.longestName', Math.max(longestIn(d.guardians, 'name'), longestIn(d.guardians, 'phone')), L.shortText],
      ['player.guardian.longestEmail', longestIn(d.guardians, 'email'), L.email],
      ['player.skill.notes', Math.max(0, ...skills.map((s) => (isMap(s) ? textLen(s.notes) : 0))), L.longText],
      ...plan(d.developmentPlan, 'player', L),
      ['player.latestTests.count', countOf(d.latestTests), L.latestTests],
      ['player.consent.text', d.consent == null ? 0 : rowsLen([d.consent]), L.consentText],
    ];
  }],
  [/^teams\/[^/]+\/players\/[^/]+\/physicalTests\/[^/]+$/, (d, L) => [['physicalTest.notes', textLen(d.notes), L.longText]]],
  [/^teams\/[^/]+\/calendar\/[^/]+$/, (d, L) => [
    ...texts(d, 'calendar', ['date', 'trainingId', 'trainingBusinessId', 'trainingName'], L.shortText),
    ['calendar.notes', textLen(d.notes), L.longText],
  ]],
  [/^teams\/[^/]+\/matches\/[^/]+$/, (d, L) => [
    ...texts(d, 'match', ['date', 'opponent'], L.shortText),
    ['match.roster.count', countOf(d.roster), L.matchRoster],
    ['match.roster.text', rowsLen(d.roster), L.matchRosterText],
    ['match.liberos.count', countOf(d.liberos), L.matchLiberos],
    ...(d.awards == null ? [] : awards(d.awards, 'match.awards', L)),
  ]],
  [/^teams\/[^/]+\/awards\/[^/]+$/, (d, L) => awards(d, 'awards', L)],
  [/^teams\/[^/]+\/scoutProfile\/[^/]+$/, (d, L) => [
    ['scoutProfile.otherKeys', otherKeys(d, ['players']), 0],
    ['scoutProfile.players.count', countOf(d.players), L.scoutProfilePlayers],
  ]],
  [/^exercises\/[^/]+$/, (d, L) => [
    ['exercise.name', textLen(d.name), L.shortText],
    ['exercise.description', textLen(d.description), L.longText],
    ['exercise.searchTokens.count', countOf(d.searchTokens), L.searchTokens],
    ['exercise.searchTokens.text', joinLen(d.searchTokens), L.searchTokensText],
  ]],
  [/^trainings\/[^/]+$/, (d, L) => [
    ...texts(d, 'training', ['name', 'ageGroupTarget', 'businessId'], L.shortText),
    ['training.description', textLen(d.description), L.longText],
    ['training.searchTokens.count', countOf(d.searchTokens), L.searchTokens],
    ['training.searchTokens.text', joinLen(d.searchTokens), L.searchTokensText],
    ['training.exercises.count', countOf(d.exercises), L.trainingExercises],
    ['training.exercises.text', rowsLen(d.exercises), L.trainingExercisesText],
    ['training.exerciseIds.count', countOf(d.exerciseIds), L.trainingExercises],
    ['training.exerciseIds.text', joinLen(d.exerciseIds), L.trainingExercisesText],
  ]],
  [/^sectionAccess\/[^/]+$/, (d, L) => emailList(d.adminEmails, 'sectionAccess.adminEmails', L.sectionEmailList, L)],
  [/^config\/skillGuide$/, (d, L) => skillGuide(d, L)],
  [/^config\/physicalTestGuide$/, (d, L) => testGuide(d, L)],
];

/** Doc paths listed per check, at most (the counts stay exact). */
export const MAX_PATHS = 20;

/**
 * Per club, per check: `{ cap, max, over, paths }` (paths of the docs over the cap, first MAX_PATHS),
 * plus `docs` (capped docs measured per club) and `over` (docs over a cap, summed over checks).
 * Docs outside `clubs/{clubId}/…`, and kinds without caps (events, members, …), are ignored.
 */
export function limitsReport(docs, L = LIMITS) {
  const clubs = {};
  let over = 0;
  for (const { path, data } of docs) {
    const m = /^clubs\/([^/]+)\/(.+)$/.exec(path);
    if (!m || !isMap(data)) continue;
    const kind = KINDS.find(([re]) => re.test(m[2]));
    if (!kind) continue;
    const club = (clubs[m[1]] ??= { docs: 0, checks: {} });
    club.docs++;
    for (const [name, value, cap] of kind[1](data, L)) {
      const c = (club.checks[name] ??= { cap, max: 0, over: 0, paths: [] });
      c.max = Math.max(c.max, value);
      if (value > cap) {
        c.over++;
        over++;
        if (c.paths.length < MAX_PATHS) c.paths.push(path);
      }
    }
  }
  return { clubs, over };
}

const shown = (n) => (n === Infinity ? 'not a text/list' : String(n));

/** Printable lines: per club, the checks over a cap (with paths) first, then every other check's maximum. */
export function formatReport({ clubs, over }) {
  const lines = [];
  const ids = Object.keys(clubs).sort();
  if (ids.length === 0) lines.push('No club documents with size caps were found.');
  for (const id of ids) {
    const { docs, checks } = clubs[id];
    const names = Object.keys(checks).sort();
    const bad = names.filter((n) => checks[n].over > 0);
    lines.push(`Club ${id}: ${docs} capped documents, ${bad.length === 0 ? 'all within the caps' : `${bad.length} check(s) over a cap`}`);
    for (const n of bad) {
      const c = checks[n];
      lines.push(`  OVER ${n}: ${c.over} doc(s) over ${c.cap}, max ${shown(c.max)}`);
      for (const p of c.paths) lines.push(`         ${p}`);
      if (c.over > c.paths.length) lines.push(`         … and ${c.over - c.paths.length} more`);
    }
    for (const n of names.filter((x) => checks[x].over === 0)) lines.push(`  ok   ${n}: max ${checks[n].max} of ${checks[n].cap}`);
  }
  lines.push(over === 0 ? 'Result: every measured field is within its cap.' : `Result: ${over} field(s) over a cap. Fix them (or raise the cap in rules and LIMITS together) before deploying the caps.`);
  return lines;
}
