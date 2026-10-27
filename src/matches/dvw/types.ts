import type { Grade, Side, Skill } from '../../types/match';

export type DvwSide = '*' | 'a'; // '*' home, 'a' visiting

export interface DvwTeam {
  name: string;
  setsWon: number;
}

/** From the final score "25-16" of a [3SET] line. */
export interface DvwSet {
  played: boolean;
  home: number;
  visiting: number;
}

export interface DvwPlayer {
  side: DvwSide;
  jersey: number;
  fileId: string;
  lastName: string;
  firstName: string;
  specialRole: 'L' | 'C' | null;
  roleCode: 1 | 2 | 3 | 4 | 5 | 6;
  /** Sets 1-5: the starting position, or null (bench `*` and did-not-play both map to null). */
  startingPositions: (number | null)[];
}

export type ScoutCode =
  | { kind: 'skill'; side: DvwSide; jersey: number | null; skill: Skill; grade: Grade } // jersey null = '$$'
  | { kind: 'point'; side: DvwSide; home: number; visiting: number }
  | { kind: 'rotation'; side: DvwSide }
  | { kind: 'sub'; side: DvwSide; outJersey: number; inJersey: number }
  | { kind: 'timeout'; side: DvwSide }
  | { kind: 'setEnd'; set: number }
  | { kind: 'other'; reason: 'teamCode' | 'note' | 'lineupMarker' | 'unparsed' };

export interface ScoutLine {
  /** 1-based line number in the file. */
  lineNo: number;
  raw: string;
  code: ScoutCode;
  set: number;
  /** P1-P6 jerseys, index 0 = P1. */
  homeCourt: (number | null)[];
  visitingCourt: (number | null)[];
}

export interface DvwFile {
  generator: string;
  date: string | null;
  season: string;
  league: string;
  teams: Record<DvwSide, DvwTeam>;
  sets: DvwSet[];
  players: DvwPlayer[];
  scout: ScoutLine[];
  warnings: DvwMessage[];
}

export interface DvwError {
  error: DvwMessage;
}

/**
 * Everything the import tells the coach: parse errors and warnings, and the mapping's issues.
 * Pure modules return these codes with their parameters; `dvwMessageText` words them in the
 * active language. Line lists carry every line (the text shows the first five).
 */
export type DvwMessage =
  | { code: 'notDvw' }
  | { code: 'unsupportedRegulation' }
  | { code: 'noRallies' }
  | { code: 'playerNoJersey'; line: string }
  | { code: 'setNumberMismatch'; set: number; lines: number[] }
  | { code: 'sameAppPlayer'; first: number; second: number }
  | { code: 'tooManyLiberos' }
  | { code: 'liberoReplaces'; jerseys: number[] }
  | { code: 'liberoNeverOnCourt' }
  | { code: 'startersUnmapped'; set: number }
  | { code: 'tooLong' }
  | { code: 'unlistedJersey'; jersey: number; line: number }
  | { code: 'droppedGrade'; skill: Skill; grade: Grade; lines: number[] }
  | { code: 'droppedUnknownPlayer'; lines: number[] }
  | { code: 'droppedForJersey'; reason: 'unmapped' | 'decided'; jersey: number; lines: number[] }
  | { code: 'subUnmapped'; line: number; out: number; in: number }
  | { code: 'endedOtherWay'; line: number; pointLine: number; winner: Side }
  | { code: 'scoreDiffers' };
