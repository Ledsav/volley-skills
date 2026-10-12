import type { PositionCategory } from './player';

export type Skill = 'S' | 'R' | 'A' | 'B' | 'D' | 'E' | 'F';
export const SKILLS: Skill[] = ['S', 'R', 'A', 'B', 'D', 'E', 'F'];

export type Grade = '#' | '+' | '!' | '-' | '/' | '=';
export const GRADES: Grade[] = ['#', '+', '!', '-', '/', '='];

export type Side = 'us' | 'them';

export type PointReason = 'oppError' | 'oppKill' | 'oppAce' | 'oppBlock' | 'unknown';
export const POINT_REASON_LABELS: Record<PointReason, string> = {
  oppError: 'Opp. error',
  oppKill: 'Opp. kill',
  oppAce: 'Opp. ace',
  oppBlock: 'Opp. block',
  unknown: 'Other',
};

export type MatchStatus = 'setup' | 'live' | 'finished';
export type Competition = 'league' | 'cup' | 'friendly' | 'tournament';
export type HomeAway = 'home' | 'away';
export type LiberoMode = 'receiving' | 'serving' | 'always';

export interface MatchFormat {
  bestOf: 3 | 5;
  setPoints: number;
  decidingSetPoints: number;
  subsPerSet: number;
  timeoutsPerSet: number;
}

export const DEFAULT_FORMAT: MatchFormat = {
  bestOf: 5,
  setPoints: 25,
  decidingSetPoints: 15,
  subsPerSet: 6,
  timeoutsPerSet: 2,
};

/** Snapshot of a player at match time, so old reports survive number changes. */
export interface RosterEntry {
  playerId: string;
  number: number;
  name: string;
  positionCategory: PositionCategory;
}

export interface LiberoConfig {
  playerId: string;
  mode: LiberoMode;
  replaces: string[];
}

export interface SetScore {
  us: number;
  them: number;
}

export interface MatchResult {
  setsUs: number;
  setsThem: number;
  sets: SetScore[];
}

export const EMPTY_RESULT: MatchResult = { setsUs: 0, setsThem: 0, sets: [] };

export type SkillCounts = Partial<Record<Skill, number>>;
/** Per player, per skill action counts for one match. */
export type UsageContribution = Record<string, SkillCounts>;

export interface UsageProfile {
  players: Record<string, { matches: number; totals: SkillCounts }>;
}

export type GradeCounts = Record<Grade, number>;

export interface SkillLine {
  attempts: number;
  grades: GradeCounts;
}

export interface PlayerStats {
  playerId: string;
  skills: Partial<Record<Skill, SkillLine>>;
  points: number;
  errors: number;
  attackEff: number | null;
  serveEff: number | null;
  receptionPos: number | null;
  receptionPerfect: number | null;
}

export interface WonTotal {
  won: number;
  total: number;
}

export interface TeamStats {
  sideOut: WonTotal;
  breakPoint: WonTotal;
  oppErrorPoints: number;
  rotations: Record<number, { won: number; lost: number }>;
  weakestRotation: number | null;
  receptionPos: number | null;
  attackEff: number | null;
  aces: number;
  serveErrors: number;
}

export interface TimeoutEffect {
  set: number;
  team: Side;
  score: SetScore;
  won: number;
  lost: number;
}

export interface MatchStats {
  players: Record<string, PlayerStats>;
  team: TeamStats;
  timeoutEffects: TimeoutEffect[];
  sourceCounts: { tap: number; text: number };
}

export type MatchSummary = MatchStats;

export interface ActiveDevice {
  id: string;
  /** Client clock, ms since epoch. */
  at: number;
}

export interface MatchSetupInput {
  date: string;
  opponent: string;
  competition: Competition;
  homeAway: HomeAway;
  format: MatchFormat;
  roster: RosterEntry[];
  liberos: LiberoConfig[];
}

export interface Match extends MatchSetupInput {
  id: string;
  status: MatchStatus;
  result: MatchResult;
  summary: MatchSummary | null;
  usageContribution: UsageContribution | null;
  activeDevice: ActiveDevice | null;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export type EventSource = 'tap' | 'text' | 'correction';

export type MatchEventPayload =
  | { type: 'setStart'; set: number; lineup: string[]; serving: Side }
  | { type: 'action'; playerId: string; skill: Skill; grade: Grade }
  | { type: 'point'; winner: Side; reason: PointReason | null }
  | { type: 'sub'; outPlayerId: string; inPlayerId: string }
  | { type: 'timeout'; team: Side }
  | { type: 'correction'; score: SetScore | null; rotation: number | null; serving: Side | null }
  | { type: 'setEnd'; set: number };

export interface EventMeta {
  order: number;
  source: EventSource;
  chunkId: string | null;
}

export type NewMatchEvent = MatchEventPayload & EventMeta;
export type MatchEvent = NewMatchEvent & { id: string };
export type ActionEvent = Extract<MatchEvent, { type: 'action' }>;
