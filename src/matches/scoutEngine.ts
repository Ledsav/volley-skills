import { rallyOutcome } from './skillGrades';
import type {
  ActionEvent,
  EventSource,
  Grade,
  LiberoConfig,
  Match,
  MatchEvent,
  MatchFormat,
  MatchResult,
  PointReason,
  RoleMap,
  SetScore,
  Side,
  Skill,
} from '../types/match';

export type EngineMatch = Pick<Match, 'format' | 'roster' | 'liberos'>;

export interface RallyRecord {
  set: number;
  /** 0-based index of the rally within its set. */
  index: number;
  serving: Side;
  rotation: number;
  winner: Side;
  reason: PointReason | null;
  scoreAfter: SetScore;
  actionIds: string[];
  endEventId: string;
}

export interface TimeoutRecord {
  set: number;
  team: Side;
  ralliesBefore: number;
  score: SetScore;
  eventId: string;
}

export interface ActionRecord {
  eventId: string;
  set: number;
  playerId: string;
  skill: Skill;
  grade: Grade;
  source: EventSource;
}

export type WarningCode =
  | 'noSet'
  | 'offCourt'
  | 'unknownPlayer'
  | 'subLimit'
  | 'illegalReentry'
  | 'subNotOnCourt'
  | 'timeoutLimit'
  | 'setEndTie';

export interface EngineWarning {
  eventId: string;
  code: WarningCode;
  message: string;
}

export interface MatchState {
  set: number;
  inSet: boolean;
  score: SetScore;
  serving: Side;
  rotation: number;
  /** Base players by zone, index 0 = P1. Liberos never appear here. */
  lineup: string[];
  /** Who is physically on court by zone (libero applied). */
  court: string[];
  activeLiberoId: string | null;
  /**
   * Role per roster player for the current set: the roster roles, overridden
   * by `setStart.roles`, with subs inheriting the outgoing player's role.
   */
  roles: RoleMap;
  setStartLineup: string[];
  currentRally: ActionEvent[];
  setsWon: SetScore;
  setScores: SetScore[];
  subsUsed: number;
  timeoutsUsed: SetScore;
  setPointReached: boolean;
  matchOver: boolean;
  rallies: RallyRecord[];
  timeouts: TimeoutRecord[];
  actions: ActionRecord[];
  warnings: EngineWarning[];
}

export function sortEvents(events: MatchEvent[]): MatchEvent[] {
  return [...events].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Side-out rotation: P2 → P1, P1 → P6, … */
export function rotateLineup(lineup: string[]): string[] {
  return lineup.map((_, i) => lineup[(i + 1) % 6]);
}

export function nextRotation(rotation: number): number {
  return rotation === 1 ? 6 : rotation - 1;
}

export function prevRotation(rotation: number): number {
  return rotation === 6 ? 1 : rotation + 1;
}

export function setTarget(format: MatchFormat, set: number): number {
  return set === format.bestOf ? format.decidingSetPoints : format.setPoints;
}

export function setsToWin(format: MatchFormat): number {
  return Math.ceil(format.bestOf / 2);
}

const BACK_ROW_ZONES = [4, 5, 0]; // P5, P6, P1

/**
 * Picks the libero for the current serve state and puts them in for the first
 * back-row player they replace. Never in P1 while we serve (liberos can't serve).
 */
export function applyLibero(
  lineup: string[],
  liberos: LiberoConfig[],
  serving: Side,
): { court: string[]; activeLiberoId: string | null } {
  const court = [...lineup];
  const libero =
    liberos.find((l) => l.mode === 'always') ??
    liberos.find((l) => l.mode === (serving === 'us' ? 'serving' : 'receiving')) ??
    null;
  if (!libero) return { court, activeLiberoId: null };
  for (const zone of BACK_ROW_ZONES) {
    if (zone === 0 && serving === 'us') continue;
    if (libero.replaces.includes(lineup[zone])) {
      court[zone] = libero.playerId;
      return { court, activeLiberoId: libero.playerId };
    }
  }
  return { court, activeLiberoId: null };
}

export function resultFromState(state: MatchState): MatchResult {
  return { setsUs: state.setsWon.us, setsThem: state.setsWon.them, sets: state.setScores };
}

/** Field-wise equality (key order in stored docs is not guaranteed, so no JSON compare). */
export function sameResult(a: MatchResult, b: MatchResult): boolean {
  return (
    a.setsUs === b.setsUs &&
    a.setsThem === b.setsThem &&
    a.sets.length === b.sets.length &&
    a.sets.every((s, i) => s.us === b.sets[i].us && s.them === b.sets[i].them)
  );
}

export function rosterRoles(match: Pick<EngineMatch, 'roster'>): RoleMap {
  return Object.fromEntries(match.roster.map((r) => [r.playerId, r.positionCategory]));
}

function initialState(): MatchState {
  return {
    set: 0,
    inSet: false,
    score: { us: 0, them: 0 },
    serving: 'us',
    rotation: 1,
    lineup: [],
    court: [],
    activeLiberoId: null,
    roles: {},
    setStartLineup: [],
    currentRally: [],
    setsWon: { us: 0, them: 0 },
    setScores: [],
    subsUsed: 0,
    timeoutsUsed: { us: 0, them: 0 },
    setPointReached: false,
    matchOver: false,
    rallies: [],
    timeouts: [],
    actions: [],
    warnings: [],
  };
}

export function replay(match: EngineMatch, events: MatchEvent[]): MatchState {
  const s = initialState();
  const rosterIds = new Set(match.roster.map((r) => r.playerId));
  const baseRoles = rosterRoles(match);
  s.roles = { ...baseRoles };
  let liberos: LiberoConfig[] = match.liberos.map((l) => ({ ...l, replaces: [...l.replaces] }));
  // Substitution pairs within the current set: out <-> in, for re-entry checks.
  let pairs: Record<string, string> = {};

  const warn = (ev: MatchEvent, code: WarningCode, message: string) => {
    s.warnings.push({ eventId: ev.id, code, message });
  };
  const ralliesInSet = () => s.rallies.filter((r) => r.set === s.set).length;

  const closeRally = (winner: Side, reason: PointReason | null, endEventId: string) => {
    const scoreAfter = { ...s.score, [winner]: s.score[winner] + 1 };
    s.rallies.push({
      set: s.set,
      index: ralliesInSet(),
      serving: s.serving,
      rotation: s.rotation,
      winner,
      reason,
      scoreAfter,
      actionIds: s.currentRally.map((a) => a.id),
      endEventId,
    });
    s.score = scoreAfter;
    if (winner === 'us' && s.serving === 'them') {
      s.lineup = rotateLineup(s.lineup);
      s.rotation = nextRotation(s.rotation);
      s.serving = 'us';
    } else if (winner === 'them' && s.serving === 'us') {
      s.serving = 'them';
    }
    s.currentRally = [];
  };

  for (const ev of sortEvents(events)) {
    if (ev.type !== 'setStart' && !s.inSet) {
      warn(ev, 'noSet', 'Recorded while no set was running — ignored.');
      continue;
    }
    switch (ev.type) {
      case 'setStart': {
        s.set = ev.set;
        s.inSet = true;
        s.score = { us: 0, them: 0 };
        s.lineup = [...ev.lineup];
        s.setStartLineup = [...ev.lineup];
        s.serving = ev.serving;
        s.roles = { ...baseRoles, ...(ev.roles ?? {}) };
        const setterZone = ev.lineup.findIndex((id) => s.roles[id] === 'S');
        s.rotation = setterZone >= 0 ? setterZone + 1 : 1;
        s.subsUsed = 0;
        s.timeoutsUsed = { us: 0, them: 0 };
        s.currentRally = [];
        liberos = match.liberos.map((l) => ({ ...l, replaces: [...l.replaces] }));
        pairs = {};
        break;
      }
      case 'action': {
        if (!rosterIds.has(ev.playerId)) {
          warn(ev, 'unknownPlayer', 'Player is not in this match roster — ignored.');
          break;
        }
        if (!s.court.includes(ev.playerId)) {
          warn(ev, 'offCourt', 'Credited to a player the app shows off court.');
        }
        s.actions.push({
          eventId: ev.id,
          set: s.set,
          playerId: ev.playerId,
          skill: ev.skill,
          grade: ev.grade,
          source: ev.source,
        });
        s.currentRally.push(ev);
        const winner = rallyOutcome(ev.skill, ev.grade);
        if (winner) closeRally(winner, null, ev.id);
        break;
      }
      case 'point':
        closeRally(ev.winner, ev.reason, ev.id);
        break;
      case 'sub': {
        const zone = s.lineup.indexOf(ev.outPlayerId);
        if (zone < 0) {
          warn(ev, 'subNotOnCourt', 'Outgoing player is not in the lineup — ignored.');
          break;
        }
        const outPartner = pairs[ev.outPlayerId];
        const inPartner = pairs[ev.inPlayerId];
        if ((outPartner && outPartner !== ev.inPlayerId) || (inPartner && inPartner !== ev.outPlayerId)) {
          warn(ev, 'illegalReentry', 'A player can only re-enter for the player who replaced them.');
        } else {
          pairs[ev.outPlayerId] = ev.inPlayerId;
          pairs[ev.inPlayerId] = ev.outPlayerId;
        }
        s.lineup = s.lineup.map((id) => (id === ev.outPlayerId ? ev.inPlayerId : id));
        if (s.roles[ev.outPlayerId]) s.roles = { ...s.roles, [ev.inPlayerId]: s.roles[ev.outPlayerId] };
        liberos = liberos.map((l) =>
          l.replaces.includes(ev.outPlayerId)
            ? { ...l, replaces: l.replaces.map((id) => (id === ev.outPlayerId ? ev.inPlayerId : id)) }
            : l,
        );
        s.subsUsed += 1;
        if (s.subsUsed > match.format.subsPerSet) {
          warn(ev, 'subLimit', `More than ${match.format.subsPerSet} substitutions this set.`);
        }
        break;
      }
      case 'timeout': {
        s.timeoutsUsed = { ...s.timeoutsUsed, [ev.team]: s.timeoutsUsed[ev.team] + 1 };
        s.timeouts.push({
          set: s.set,
          team: ev.team,
          ralliesBefore: ralliesInSet(),
          score: { ...s.score },
          eventId: ev.id,
        });
        if (s.timeoutsUsed[ev.team] > match.format.timeoutsPerSet) {
          warn(ev, 'timeoutLimit', `More than ${match.format.timeoutsPerSet} timeouts this set.`);
        }
        break;
      }
      case 'correction': {
        if (ev.score) s.score = { ...ev.score };
        if (ev.serving) s.serving = ev.serving;
        if (ev.rotation !== null) {
          for (let k = 0; k < 6 && s.rotation !== ev.rotation; k++) {
            s.lineup = rotateLineup(s.lineup);
            s.rotation = nextRotation(s.rotation);
          }
        }
        break;
      }
      case 'setEnd': {
        if (s.score.us === s.score.them) {
          warn(ev, 'setEndTie', 'A set cannot end tied — ignored.');
          break;
        }
        s.setScores.push({ ...s.score });
        s.setsWon[s.score.us > s.score.them ? 'us' : 'them'] += 1;
        s.inSet = false;
        s.currentRally = [];
        break;
      }
    }
    const { court, activeLiberoId } = applyLibero(s.lineup, liberos, s.serving);
    s.court = court;
    s.activeLiberoId = activeLiberoId;
  }

  const target = setTarget(match.format, s.set);
  const top = Math.max(s.score.us, s.score.them);
  s.setPointReached = s.inSet && top >= target && Math.abs(s.score.us - s.score.them) >= 2;
  s.matchOver = Math.max(s.setsWon.us, s.setsWon.them) >= setsToWin(match.format);
  return s;
}
