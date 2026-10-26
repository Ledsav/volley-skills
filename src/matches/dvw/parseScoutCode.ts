import type { Grade, Skill } from '../../types/match';
import type { DvwSide, ScoutCode } from './types';

const LINEUP = /^[*a](P\d{1,2}|z\d)>LUp/;
const TEAM_CODE = /^[*a]\$\$&/;
const SET_END = /^\*\*(\d)set/;
const POINT = /^([*a])p(\d{1,2}):(\d{1,2})/;
const SUB = /^([*a])c(\d{1,2}):(\d{1,2})/;
const TIMEOUT = /^([*a])T$/;
const ROTATION = /^([*a])z\d/;
const SKILL = /^([*a])(\d{1,2}|\$\$)([SRABDEF])(.)([#+!\-/=])/;

const other = (reason: 'teamCode' | 'note' | 'lineupMarker' | 'unparsed'): ScoutCode => ({ kind: 'other', reason });

/** Parses one scout code (the first field of a [3SCOUT] line). Never throws. */
export function parseScoutCode(code: string): ScoutCode {
  if (LINEUP.test(code)) return other('lineupMarker');
  if (TEAM_CODE.test(code)) return other('teamCode');
  if (code.startsWith('>')) return other('note');
  let m = SET_END.exec(code);
  if (m) return { kind: 'setEnd', set: Number(m[1]) };
  m = POINT.exec(code);
  if (m) return { kind: 'point', side: m[1] as DvwSide, home: Number(m[2]), visiting: Number(m[3]) };
  m = SUB.exec(code);
  if (m) return { kind: 'sub', side: m[1] as DvwSide, outJersey: Number(m[2]), inJersey: Number(m[3]) };
  m = TIMEOUT.exec(code);
  if (m) return { kind: 'timeout', side: m[1] as DvwSide };
  m = ROTATION.exec(code);
  if (m) return { kind: 'rotation', side: m[1] as DvwSide };
  m = SKILL.exec(code);
  if (m) {
    return {
      kind: 'skill',
      side: m[1] as DvwSide,
      jersey: m[2] === '$$' ? null : Number(m[2]),
      skill: m[3] as Skill,
      grade: m[5] as Grade,
    };
  }
  return other('unparsed');
}
