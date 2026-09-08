import { describe, expect, it } from 'vitest';
import { validatePlayerRows } from './playersImport';

const NULL_SKILLS = {
  serve: null, attack: null, set: null, defence: null,
  reception: null, jump: null, speed: null, iq: null,
};

describe('validatePlayerRows', () => {
  it('accepts a minimal row and fills defaults', () => {
    const result = validatePlayerRows([{ number: 7, fullName: 'Jane Doe' }]);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual([
      {
        number: 7,
        fullName: 'Jane Doe',
        dob: '',
        nationality: '',
        licenseNumber: '',
        position: '',
        playerPhone: '',
        guardians: [],
        skills: NULL_SKILLS,
      },
    ]);
  });

  it('reports a missing or non-numeric number', () => {
    const result = validatePlayerRows([{ fullName: 'A' }, { number: '3', fullName: 'B' }]);
    expect(result.errors).toEqual([
      'row 1: "number" is required and must be a number',
      'row 2: "number" is required and must be a number',
    ]);
  });

  it('reports a missing fullName', () => {
    const result = validatePlayerRows([{ number: 1 }]);
    expect(result.errors).toEqual(['row 1: "fullName" is required']);
  });

  it('reports a malformed dob but accepts YYYY-MM-DD', () => {
    expect(validatePlayerRows([{ number: 1, fullName: 'A', dob: '12/03/2010' }]).errors).toEqual([
      'row 1: "dob" must be YYYY-MM-DD',
    ]);
    expect(validatePlayerRows([{ number: 1, fullName: 'A', dob: '2010-03-12' }]).errors).toEqual([]);
  });

  it('validates guardians', () => {
    const result = validatePlayerRows([
      { number: 1, fullName: 'A', guardians: [{ relation: 'aunt', name: '' }] },
    ]);
    expect(result.errors).toEqual([
      'row 1: guardian 1 "relation" must be mother, father, or other',
      'row 1: guardian 1 "name" is required',
    ]);
  });

  it('expands a partial skills map and rejects out-of-range or unknown keys', () => {
    const ok = validatePlayerRows([{ number: 1, fullName: 'A', skills: { serve: 5, iq: null } }]);
    expect(ok.errors).toEqual([]);
    expect(ok.inputs[0].skills).toEqual({ ...NULL_SKILLS, serve: 5 });

    const bad = validatePlayerRows([
      { number: 1, fullName: 'A', skills: { serve: 0, attack: 11, made_up: 5 } },
    ]);
    expect(bad.errors).toEqual([
      'row 1: "skills.serve" must be a number from 1 to 10, or null',
      'row 1: "skills.attack" must be a number from 1 to 10, or null',
      'row 1: "skills" has an unknown key "made_up"',
    ]);
  });

  it('reports a non-object row', () => {
    expect(validatePlayerRows([5]).errors).toEqual(['row 1: each entry must be a JSON object']);
  });
});
