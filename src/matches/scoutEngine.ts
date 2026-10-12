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

/* eslint-disable @typescript-eslint/no-unused-vars -- stub; Task 3 replaces this */
/** Replaced in Task 3 with real libero logic. */
export function applyLibero(
  lineup: string[],
  _liberos: LiberoConfig[],
  _serving: Side,
): { court: string[]; activeLiberoId: string | null } {
  return { court: [...lineup], activeLiberoId: null };
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export function resultFromState(state: MatchState): MatchResult {
  return { setsUs: state.setsWon.us, setsThem: state.setsWon.them, sets: state.setScores };
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
  const setterIds = new Set(match.roster.filter((r) => r.positionCategory === 'S').map((r) => r.playerId));
  const liberos = match.liberos;

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
        const setterZone = ev.lineup.findIndex((id) => setterIds.has(id));
        s.rotation = setterZone >= 0 ? setterZone + 1 : 1;
        s.subsUsed = 0;
        s.timeoutsUsed = { us: 0, them: 0 };
        s.currentRally = [];
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
      case 'sub':
      case 'timeout':
        // Implemented in Task 3.
        break;
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
