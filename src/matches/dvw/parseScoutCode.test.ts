import { describe, expect, it } from 'vitest';
import { parseScoutCode } from './parseScoutCode';

describe('parseScoutCode', () => {
  it('parses a skill line', () => {
    expect(parseScoutCode('*07SH+~~~45AM')).toEqual({ kind: 'skill', side: '*', jersey: 7, skill: 'S', grade: '+' });
    expect(parseScoutCode('a12RM-')).toEqual({ kind: 'skill', side: 'a', jersey: 12, skill: 'R', grade: '-' });
  });
  it('maps $$ to a null jersey', () => {
    expect(parseScoutCode('a$$SM=')).toEqual({ kind: 'skill', side: 'a', jersey: null, skill: 'S', grade: '=' });
  });
  it('treats a skill without a type char as unparsed', () => {
    expect(parseScoutCode('*07S#')).toEqual({ kind: 'other', reason: 'unparsed' });
  });
  it('parses a point', () => {
    expect(parseScoutCode('ap12:14')).toEqual({ kind: 'point', side: 'a', home: 12, visiting: 14 });
  });
  it('parses a substitution', () => {
    expect(parseScoutCode('*c05:11')).toEqual({ kind: 'sub', side: '*', outJersey: 5, inJersey: 11 });
  });
  it('parses a timeout', () => {
    expect(parseScoutCode('aT')).toEqual({ kind: 'timeout', side: 'a' });
  });
  it('parses a set end', () => {
    expect(parseScoutCode('**2set')).toEqual({ kind: 'setEnd', set: 2 });
  });
  it('parses a rotation', () => {
    expect(parseScoutCode('*z3')).toEqual({ kind: 'rotation', side: '*' });
  });
  it('recognises lineup markers', () => {
    expect(parseScoutCode('*P05>LUp')).toEqual({ kind: 'other', reason: 'lineupMarker' });
    expect(parseScoutCode('*z3>LUp')).toEqual({ kind: 'other', reason: 'lineupMarker' });
  });
  it('recognises team codes and notes', () => {
    expect(parseScoutCode('*$$&H#')).toEqual({ kind: 'other', reason: 'teamCode' });
    expect(parseScoutCode('>ROT')).toEqual({ kind: 'other', reason: 'note' });
  });
  it('never throws on junk', () => {
    expect(parseScoutCode('*zz')).toEqual({ kind: 'other', reason: 'unparsed' });
    expect(parseScoutCode('')).toEqual({ kind: 'other', reason: 'unparsed' });
  });
});
