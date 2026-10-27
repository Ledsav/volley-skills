import { describe, expect, it } from 'vitest';
import { validateTeamRows } from './teamsImport';

describe('validateTeamRows', () => {
  it('accepts a full row', () => {
    const result = validateTeamRows([
      { name: 'U15 Girls', ageGroup: 'U15', season: '2026-27', description: 'girls', gender: 'women' },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual([
      { name: 'U15 Girls', ageGroup: 'U15', season: '2026-27', description: 'girls', gender: 'women' },
    ]);
  });

  it('ignores a club key', () => {
    const result = validateTeamRows([{ name: 'X', club: 'Old VC', gender: 'mixed' }]);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual([{ name: 'X', ageGroup: '', season: '', description: '', gender: 'mixed' }]);
  });

  it('defaults every optional field to an empty string', () => {
    const result = validateTeamRows([{ name: 'Solo', gender: 'men' }]);
    expect(result.inputs).toEqual([{ name: 'Solo', ageGroup: '', season: '', description: '', gender: 'men' }]);
  });

  it('trims the name and reports it when missing', () => {
    const result = validateTeamRows([{ name: '  ', gender: 'men' }, { gender: 'men' }]);
    expect(result.errors).toEqual(['row 1: "name" is required', 'row 2: "name" is required']);
    expect(result.inputs).toEqual([]);
  });

  it('reports a wrong-typed optional field', () => {
    const result = validateTeamRows([{ name: 'X', season: 2026, gender: 'men' }]);
    expect(result.errors).toEqual(['row 1: "season" must be text']);
  });

  it('stores a gender of men as men, ignoring case and spaces', () => {
    const result = validateTeamRows([{ name: 'A', gender: ' Men ' }]);
    expect(result.errors).toEqual([]);
    expect(result.inputs[0].gender).toBe('men');
  });

  it('reports a missing or unknown gender, naming the row', () => {
    const result = validateTeamRows([{ name: 'A' }, { name: 'B', gender: 'female' }, { name: 'C', gender: 3 }]);
    expect(result.errors).toEqual([
      'row 1: "gender" is required (women, men or mixed)',
      'row 2: "gender" must be women, men or mixed',
      'row 3: "gender" must be women, men or mixed',
    ]);
    expect(result.inputs).toEqual([]);
  });

  it('reports a non-object row', () => {
    const result = validateTeamRows(['x']);
    expect(result.errors).toEqual(['row 1: each entry must be a JSON object']);
  });
});
