import { describe, expect, it } from 'vitest';
import { asBusinessId, formatBusinessId } from './businessId';

describe('formatBusinessId', () => {
  it('zero-pads to four digits with a TR- prefix', () => {
    expect(formatBusinessId(7)).toBe('TR-0007');
  });

  it('does not truncate sequences beyond four digits', () => {
    expect(formatBusinessId(12345)).toBe('TR-12345');
  });

  it('handles the first sequence', () => {
    expect(formatBusinessId(1)).toBe('TR-0001');
  });
});

describe('asBusinessId', () => {
  it('reads a typed business ID in any of its short forms', () => {
    expect(asBusinessId('TR-0007')).toBe('TR-0007');
    expect(asBusinessId(' tr-7 ')).toBe('TR-0007');
    expect(asBusinessId('tr7')).toBe('TR-0007');
    expect(asBusinessId('12')).toBe('TR-0012');
  });

  it('is null for a name', () => {
    expect(asBusinessId('Passing circuit')).toBeNull();
    expect(asBusinessId('')).toBeNull();
    expect(asBusinessId('U17')).toBeNull();
  });
});
