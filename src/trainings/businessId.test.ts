import { describe, expect, it } from 'vitest';
import { formatBusinessId } from './businessId';

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
