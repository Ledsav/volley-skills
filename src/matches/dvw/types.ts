import type { Grade, Skill } from '../../types/match';

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
  warnings: string[];
}

export interface DvwError {
  error: string;
}
