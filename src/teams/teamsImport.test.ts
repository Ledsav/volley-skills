import { describe, expect, it } from 'vitest';
import { validateTeamRows } from './teamsImport';

describe('validateTeamRows', () => {
  it('accepts a full row', () => {
    const result = validateTeamRows([
      { name: 'VCB U15', club: 'VCB', ageGroup: 'U15', season: '2026-27', description: 'girls' },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual([
      { name: 'VCB U15', club: 'VCB', ageGroup: 'U15', season: '2026-27', description: 'girls' },
    ]);
  });

  it('defaults every optional field to an empty string', () => {
    const result = validateTeamRows([{ name: 'Solo' }]);
    expect(result.inputs).toEqual([{ name: 'Solo', club: '', ageGroup: '', season: '', description: '' }]);
  });

  it('trims the name and reports it when missing', () => {
    const result = validateTeamRows([{ name: '  ' }, {}]);
    expect(result.errors).toEqual(['row 1: "name" is required', 'row 2: "name" is required']);
    expect(result.inputs).toEqual([]);
  });

  it('reports a wrong-typed optional field', () => {
    const result = validateTeamRows([{ name: 'X', season: 2026 }]);
    expect(result.errors).toEqual(['row 1: "season" must be text']);
  });

  it('reports a non-object row', () => {
    const result = validateTeamRows(['x']);
    expect(result.errors).toEqual(['row 1: each entry must be a JSON object']);
  });
});
