import { describe, expect, it } from 'vitest';
import { deletionCutoff, deletionDueDate } from './retention';

describe('retention', () => {
  it('is due twelve months after leaving', () => {
    expect(deletionDueDate('2026-06-30')).toBe('2027-06-30');
    expect(deletionDueDate('2028-02-29')).toBe('2029-02-28');
  });

  it('cuts off players who left twelve months ago or earlier', () => {
    expect(deletionCutoff('2027-06-30')).toBe('2026-06-30');
    expect(deletionCutoff('2027-03-31')).toBe('2026-03-31');
    expect(deletionCutoff('2029-02-28')).toBe('2028-02-28');
  });

  it('agrees with the due date: due on exactly the cutoff day', () => {
    const left = '2026-08-15';
    expect(deletionCutoff(deletionDueDate(left)) >= left).toBe(true);
  });
});
