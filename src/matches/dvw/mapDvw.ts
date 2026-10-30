import {
  DEFAULT_FORMAT,
  type Grade,
  type LiberoConfig,
  type MatchEvent,
  type MatchEventPayload,
  type MatchSetupInput,
  type NewMatchEvent,
  type PointReason,
  type RosterEntry,
  type SetScore,
  type Side,
  type Skill,
} from '../../types/match';
import { LIMITS } from '../../types/limits';
import type { Player, PositionCategory } from '../../types/player';
import { replay, type EngineMatch } from '../scoutEngine';
import { POINT_REASONS, rallyOutcome, validGrades } from '../skillGrades';
import type { DvwFile, DvwMessage, DvwPlayer, DvwSide, ScoutLine } from './types';

/** Key `${side}${jersey}`, value an app playerId, or null = Skip. */
export type PlayerMapping = Record<string, string | null>;

export interface DvwIssue {
  kind: 'blocking' | 'warning';
  message: DvwMessage;
  lines: number[];
}

export interface DvwChecks {
  fileSets: SetScore[];
  pointLineSets: SetScore[];
  replaySets: SetScore[];
  /** Line numbers of the point lines that needed a score correction. */
  corrections: number[];
  eventCounts: Record<MatchEventPayload['type'], number>;
  ignoredLines: number;
}

export interface DvwPlan {
  setup: MatchSetupInput;
  events: NewMatchEvent[];
  checks: DvwChecks;
  issues: DvwIssue[];
}

export const MAX_IMPORT_EVENTS = 1900;

const ROLE_BY_CODE: Partial<Record<DvwPlayer['roleCode'], PositionCategory>> = { 5: 'S', 2: 'OH', 3: 'O', 4: 'MB', 1: 'L' };

const keyOf = (side: DvwSide, jersey: number) => `${side}${jersey}`;
const courtOf = (line: ScoutLine, side: DvwSide) => (side === '*' ? line.homeCourt : line.visitingCourt);

/** A file score (home:visiting) seen from our side. */
function orient(us: DvwSide, home: number, visiting: number): SetScore {
  return us === '*' ? { us: home, them: visiting } : { us: visiting, them: home };
}

/** Our jerseys seen in the scout (on court, in a skill or a sub line) → the first line seen on. */
function seenJerseys(file: DvwFile, us: DvwSide): Map<number, number> {
  const seen = new Map<number, number>();
  const see = (j: number, lineNo: number) => {
    if (!seen.has(j)) seen.set(j, lineNo);
  };
  for (const line of file.scout) {
    for (const j of courtOf(line, us)) if (j !== null) see(j, line.lineNo);
    const c = line.code;
    if (c.kind === 'skill' && c.side === us && c.jersey !== null) see(c.jersey, line.lineNo);
    if (c.kind === 'sub' && c.side === us) [c.outJersey, c.inJersey].forEach((j) => see(j, line.lineNo));
  }
  return seen;
}

/** Our jerseys seen in the scout that the file's player list lacks, with the first line seen on. */
function unlistedJerseys(file: DvwFile, us: DvwSide): [number, number][] {
  const listed = new Set(file.players.filter((p) => p.side === us).map((p) => p.jersey));
  return [...seenJerseys(file, us)].filter(([j]) => !listed.has(j)).sort(([a], [b]) => a - b);
}

/**
 * Our players who appear in the scout: on court in any line, in a skill line or in a sub line.
 * A jersey missing from `[3PLAYERS]` gets a nameless stand-in so it can still be mapped or skipped.
 */
export function ourFilePlayers(file: DvwFile, us: DvwSide): DvwPlayer[] {
  const seen = seenJerseys(file, us);
  const unlisted = unlistedJerseys(file, us).map(
    ([jersey]): DvwPlayer => ({
      side: us, jersey, fileId: '', lastName: '', firstName: '', specialRole: null, roleCode: 6, startingPositions: [],
    }),
  );
  return [...file.players.filter((p) => p.side === us && seen.has(p.jersey)), ...unlisted];
}

/** Each of our file players → the app player with the same jersey, or null. */
export function autoMapPlayers(file: DvwFile, us: DvwSide, players: Player[]): PlayerMapping {
  return Object.fromEntries(
    ourFilePlayers(file, us).map((p) => [keyOf(us, p.jersey), players.find((a) => a.number === p.jersey)?.id ?? null]),
  );
}

/** What the opponent's last skill line says about the point; `unknown` when it does not fit the winner. */
function pointReason(winner: Side, opp: { skill: Skill; grade: Grade } | null): PointReason {
  let reason: PointReason = 'unknown';
  if (opp?.grade === '#') {
    reason = opp.skill === 'S' ? 'oppAce' : opp.skill === 'A' ? 'oppKill' : opp.skill === 'B' ? 'oppBlock' : 'unknown';
  } else if (opp && (opp.grade === '=' || (opp.grade === '/' && (opp.skill === 'A' || opp.skill === 'B')))) {
    reason = 'oppError';
  }
  return POINT_REASONS[winner].includes(reason) ? reason : 'unknown';
}

/** Why one of our skill lines was dropped (one grouped warning per jersey and reason). */
type DropReason = 'unmapped' | 'unknownPlayer' | 'decided';

function dropMessage(reason: DropReason, jersey: number | null, lines: number[]): DvwMessage {
  if (reason === 'unknownPlayer' || jersey === null) return { code: 'droppedUnknownPlayer', lines };
  return { code: 'droppedForJersey', reason, jersey, lines };
}

/** Court indexes of the back row: P1, P5, P6. */
const BACK_ROW = [0, 4, 5];

/**
 * Our jerseys the libero stood in for. DataVolley keeps the replaced player in P1-P6, so a player
 * who is in the back row for at least 10 of our skill lines yet plays the ball on under 5% of them
 * was off court (a real file had a middle with one stray dig in 94 such lines). P1 in a rally we served is left out: the server stays on and plays that rally.
 */
function replacedByLibero(file: DvwFile, us: DvwSide): number[] {
  const inBack = new Map<number, number>();
  const playedBack = new Map<number, number>();
  let server: DvwSide | null = null;
  for (const line of file.scout) {
    const c = line.code;
    if (c.kind === 'point') server = null;
    if (c.kind !== 'skill' || c.side !== us || c.skill === 'S') {
      if (c.kind === 'skill' && c.skill === 'S') server = c.side;
      continue;
    }
    const court = courtOf(line, us);
    for (const pos of BACK_ROW) {
      const j = court[pos];
      if (j === null || (pos === 0 && server === us)) continue;
      inBack.set(j, (inBack.get(j) ?? 0) + 1);
      if (c.jersey === j) playedBack.set(j, (playedBack.get(j) ?? 0) + 1);
    }
  }
  return [...inBack]
    .filter(([j, n]) => n >= 10 && (playedBack.get(j) ?? 0) / n < 0.05)
    .map(([j]) => j)
    .sort((a, b) => a - b);
}

function buildSetup(file: DvwFile, us: DvwSide, mapping: PlayerMapping, players: Player[], issues: DvwIssue[]): MatchSetupInput {
  const roster: RosterEntry[] = [];
  const liberoIds: string[] = [];
  /** App playerId → the first file jersey mapped to it. */
  const mappedFrom = new Map<string, number>();
  const seen = seenJerseys(file, us);
  for (const fp of ourFilePlayers(file, us)) {
    const app = players.find((p) => p.id === mapping[keyOf(us, fp.jersey)]);
    if (!app) continue;
    const first = mappedFrom.get(app.id);
    if (first !== undefined) {
      // Two file players merged into one app player would silently merge their stats.
      const lineNo = seen.get(fp.jersey);
      issues.push({
        kind: 'blocking',
        message: { code: 'sameAppPlayer', first, second: fp.jersey },
        lines: lineNo === undefined ? [] : [lineNo],
      });
      continue;
    }
    mappedFrom.set(app.id, fp.jersey);
    const isLibero = fp.specialRole === 'L' || fp.roleCode === 1;
    roster.push({
      playerId: app.id,
      number: app.number,
      name: app.fullName,
      positionCategory: isLibero ? 'L' : ROLE_BY_CODE[fp.roleCode] ?? app.positionCategory,
    });
    if (isLibero) liberoIds.push(app.id);
  }
  if (liberoIds.length > 2) {
    issues.push({ kind: 'blocking', message: { code: 'tooManyLiberos' }, lines: [] });
  }
  // DataVolley never lists the libero in P1-P6: the libero is on court for any back-row middle.
  // Real files rarely carry role codes, so without a known middle the scout says who was replaced.
  let middles = roster.filter((r) => r.positionCategory === 'MB').map((r) => r.playerId);
  if (liberoIds.length > 0 && middles.length === 0) {
    const ids = new Set(roster.map((r) => r.playerId));
    const appId = (j: number) => mapping[keyOf(us, j)] ?? null;
    const replaced = replacedByLibero(file, us).filter((j) => {
      const id = appId(j);
      return id !== null && ids.has(id) && !liberoIds.includes(id);
    });
    middles = replaced.map((j) => appId(j) as string);
    issues.push({
      kind: 'warning',
      message: replaced.length === 0 ? { code: 'liberoNeverOnCourt' } : { code: 'liberoReplaces', jerseys: replaced },
      lines: [],
    });
  }
  const liberos: LiberoConfig[] = liberoIds
    .slice(0, 2)
    .map((playerId) => ({ playerId, mode: 'always', replaces: [...middles] }));
  const them = us === '*' ? 'a' : '*';
  return {
    date: file.date ?? '',
    // The rules cap the opponent at LIMITS.shortText; a file's team name is cut to fit.
    opponent: file.teams[them].name.slice(0, LIMITS.shortText),
    competition: 'league',
    homeAway: us === '*' ? 'home' : 'away',
    format: { ...DEFAULT_FORMAT, ...(Math.max(file.teams['*'].setsWon, file.teams.a.setsWon) === 2 ? { bestOf: 3 } : {}) },
    roster,
    liberos,
  };
}

/** A line held until the rally's point line: one of our actions, or a sub or timeout in between. */
type Held =
  | { kind: 'action'; playerId: string; skill: Skill; grade: Grade; jersey: number; lineNo: number }
  | { kind: 'event'; payload: MatchEventPayload };

interface Rally {
  /** Held until the point line says who won, so a wrong-way action drops alone, in file order. */
  pending: Held[];
  /** Our emitted action that decided this file rally (the engine has already closed it). */
  decided: { winner: Side; lineNo: number } | null;
  lastOpp: { skill: Skill; grade: Grade } | null;
}

const newRally = (): Rally => ({ pending: [], decided: null, lastOpp: null });

/** DataVolley grades the app reads as another: a block "!" (poor, ball to the opponent) is a touch theirs. */
const GRADE_ALIASES: Partial<Record<Skill, Partial<Record<Grade, Grade>>>> = { B: { '!': '-' } };

export function mapDvw(
  file: DvwFile,
  opts: { us: DvwSide; mapping: PlayerMapping; players: Player[]; importId: string },
): DvwPlan {
  const { us, mapping, players, importId } = opts;
  const issues: DvwIssue[] = [];
  const warn = (message: DvwMessage, lines: number[]) => issues.push({ kind: 'warning', message, lines });
  const setup = buildSetup(file, us, mapping, players, issues);
  for (const [jersey, lineNo] of unlistedJerseys(file, us)) {
    if (mapping[keyOf(us, jersey)]) warn({ code: 'unlistedJersey', jersey, line: lineNo }, [lineNo]);
  }
  const engine: EngineMatch = { format: setup.format, roster: setup.roster, liberos: setup.liberos };
  const rosterIds = new Set(setup.roster.map((r) => r.playerId));
  const idOf = (jersey: number): string | null => {
    const id = mapping[keyOf(us, jersey)];
    return id && rosterIds.has(id) ? id : null;
  };
  const roles = Object.fromEntries(setup.roster.map((r) => [r.playerId, r.positionCategory]));

  const firstServe = new Map<number, DvwSide>();
  for (const line of file.scout) {
    if (line.code.kind === 'skill' && line.code.skill === 'S' && !firstServe.has(line.set)) firstServe.set(line.set, line.code.side);
  }

  const payloads: MatchEventPayload[] = [];
  const toEvents = (list: MatchEventPayload[]): NewMatchEvent[] =>
    list.map((p, i) => ({ ...p, order: i + 1, source: 'import', chunkId: importId }) as NewMatchEvent);
  /** For the in-memory replays only; Firestore assigns the real ids on write. */
  const withMeta = (list: MatchEventPayload[]): MatchEvent[] => toEvents(list).map((e) => ({ ...e, id: `e${e.order}` }));
  const corrections: number[] = [];
  const pointLineSets = new Map<number, SetScore>();
  let ignoredLines = 0;
  /** `${skill}${grade}` → line numbers of our actions dropped for a grade the app does not offer. */
  const droppedGrades = new Map<string, number[]>();
  /** `${reason}:${jersey}` → our dropped skill lines, grouped into one warning each. */
  const droppedActions = new Map<string, { reason: DropReason; jersey: number | null; lines: number[] }>();
  const drop = (reason: DropReason, jersey: number | null, lineNo: number) => {
    const key = `${reason}:${jersey ?? '$$'}`;
    const entry = droppedActions.get(key) ?? { reason, jersey, lines: [] };
    entry.lines.push(lineNo);
    droppedActions.set(key, entry);
  };
  let set = 0;
  let setStartIndex = 0;
  /** The current set's end marker has been seen: later subs and timeouts belong to no set. */
  let setEnded = false;
  let rally = newRally();

  /**
   * Emits the rally's held lines in order. With the point line's winner, an action that would end
   * the rally the other way is dropped on its own; without one (the set ended or the file stopped
   * before a point line), the first deciding action closes the rally. Our actions after the
   * decider are dropped; held subs and timeouts are always kept.
   */
  const flush = (point: { winner: Side; lineNo: number } | null) => {
    for (const a of rally.pending) {
      if (a.kind === 'event') {
        payloads.push(a.payload);
        continue;
      }
      if (rally.decided) {
        drop('decided', a.jersey, a.lineNo);
        continue;
      }
      const winner = rallyOutcome(a.skill, a.grade);
      if (winner && point && winner !== point.winner) {
        warn({ code: 'endedOtherWay', line: a.lineNo, pointLine: point.lineNo, winner: point.winner }, [a.lineNo]);
        continue;
      }
      payloads.push({ type: 'action', playerId: a.playerId, skill: a.skill, grade: a.grade });
      if (winner) rally.decided = { winner, lineNo: a.lineNo };
    }
    rally.pending = [];
  };

  const startSet = (line: ScoutLine) => {
    flush(null);
    set = line.set;
    setStartIndex = payloads.length;
    setEnded = false;
    rally = newRally();
    const court = courtOf(line, us);
    const lineup = court.map((j) => (j === null ? null : idOf(j)));
    if (lineup.length !== 6 || lineup.some((id) => id === null)) {
      issues.push({
        kind: 'blocking',
        message: { code: 'startersUnmapped', set },
        lines: [line.lineNo],
      });
    }
    const serve = firstServe.get(set) ?? us;
    payloads.push({ type: 'setStart', set, lineup: lineup.map((id) => id ?? ''), serving: serve === us ? 'us' : 'them', roles });
  };

  const onPoint = (line: ScoutLine, side: DvwSide, home: number, visiting: number) => {
    const winner: Side = side === us ? 'us' : 'them';
    flush({ winner, lineNo: line.lineNo });
    // flush never lets an action decide the rally for the other side.
    if (!rally.decided) payloads.push({ type: 'point', winner, reason: pointReason(winner, rally.lastOpp) });
    // §4.7: re-sync the score whenever the replay drifts from the file.
    const fileScore = orient(us, home, visiting);
    const now = replay(engine, withMeta(payloads.slice(setStartIndex))).score;
    if (now.us !== fileScore.us || now.them !== fileScore.them) {
      payloads.push({ type: 'correction', score: fileScore, rotation: null, serving: null });
      corrections.push(line.lineNo);
    }
    pointLineSets.set(set, fileScore);
    rally = newRally();
  };

  for (const line of file.scout) {
    const c = line.code;
    if (line.set !== set && c.kind !== 'setEnd') startSet(line);
    switch (c.kind) {
      case 'skill': {
        if (c.side !== us) {
          rally.lastOpp = { skill: c.skill, grade: c.grade };
          break;
        }
        const id = c.jersey === null ? null : idOf(c.jersey);
        const grade = GRADE_ALIASES[c.skill]?.[c.grade] ?? c.grade;
        if (c.jersey === null) drop('unknownPlayer', null, line.lineNo);
        else if (!id) drop('unmapped', c.jersey, line.lineNo);
        else if (!validGrades(c.skill).includes(grade)) {
          const key = `${c.skill}${grade}`;
          droppedGrades.set(key, [...(droppedGrades.get(key) ?? []), line.lineNo]);
        } else {
          rally.pending.push({ kind: 'action', playerId: id, skill: c.skill, grade, jersey: c.jersey, lineNo: line.lineNo });
        }
        break;
      }
      case 'point':
        onPoint(line, c.side, c.home, c.visiting);
        break;
      case 'sub': {
        if (c.side !== us) break;
        if (setEnded) {
          ignoredLines += 1;
          break;
        }
        const outId = idOf(c.outJersey);
        const inId = idOf(c.inJersey);
        if (outId && inId) rally.pending.push({ kind: 'event', payload: { type: 'sub', outPlayerId: outId, inPlayerId: inId } });
        else warn({ code: 'subUnmapped', line: line.lineNo, out: c.outJersey, in: c.inJersey }, [line.lineNo]);
        break;
      }
      case 'timeout':
        if (setEnded) {
          ignoredLines += 1;
          break;
        }
        rally.pending.push({ kind: 'event', payload: { type: 'timeout', team: c.side === us ? 'us' : 'them' } });
        break;
      case 'setEnd':
        flush(null);
        payloads.push({ type: 'setEnd', set: line.set });
        setEnded = true;
        rally = newRally();
        break;
      case 'other':
        // Lineup markers are used: the lineups come from their court fields.
        if (c.reason !== 'lineupMarker') ignoredLines += 1;
        break;
      case 'rotation':
        break;
    }
  }
  flush(null);
  // A file saved before its last set marker: close that set if its score already ends it.
  if (set > 0 && !setEnded && replay(engine, withMeta(payloads.slice(setStartIndex))).setPointReached) {
    payloads.push({ type: 'setEnd', set });
  }

  for (const { reason, jersey, lines } of droppedActions.values()) warn(dropMessage(reason, jersey, lines), lines.slice(0, 5));
  for (const [key, lines] of droppedGrades) warn({ code: 'droppedGrade', skill: key[0] as Skill, grade: key[1] as Grade, lines }, lines.slice(0, 5));

  if (payloads.length > MAX_IMPORT_EVENTS) {
    issues.push({ kind: 'blocking', message: { code: 'tooLong' }, lines: [] });
  }

  const events = toEvents(payloads);
  const fileSets = file.sets.filter((s) => s.played).map((s) => orient(us, s.home, s.visiting));
  const replaySets = replay(engine, withMeta(payloads)).setScores;
  const sameSets =
    replaySets.length === fileSets.length && replaySets.every((s, i) => s.us === fileSets[i].us && s.them === fileSets[i].them);
  if (!sameSets) warn({ code: 'scoreDiffers' }, []);

  const eventCounts: DvwChecks['eventCounts'] = { setStart: 0, action: 0, point: 0, sub: 0, timeout: 0, correction: 0, setEnd: 0 };
  for (const e of payloads) eventCounts[e.type] += 1;

  return {
    setup,
    events,
    checks: {
      fileSets,
      pointLineSets: [...pointLineSets.entries()].sort(([a], [b]) => a - b).map(([, score]) => score),
      replaySets,
      corrections,
      eventCounts,
      ignoredLines,
    },
    issues,
  };
}
