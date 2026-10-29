import { describe, expect, it } from 'vitest';
import { GRADE_BAR_CLASS } from './gradeBarStyles';

const opacity = (c: string) => Number(c.split('/')[1] ?? 100);

describe('GRADE_BAR_CLASS', () => {
  it('keeps the grade colour meanings', () => {
    expect(GRADE_BAR_CLASS['#']).toBe('bg-green');
    expect(GRADE_BAR_CLASS['+']).toMatch(/^bg-green\//);
    expect(opacity(GRADE_BAR_CLASS['+'])).toBeLessThan(100);
    expect(GRADE_BAR_CLASS['!']).toContain('ink-3');
    expect(GRADE_BAR_CLASS['-']).toMatch(/^bg-orange\//);
    expect(GRADE_BAR_CLASS['/']).toMatch(/^bg-orange\//);
    expect(opacity(GRADE_BAR_CLASS['/'])).toBeGreaterThan(opacity(GRADE_BAR_CLASS['-']));
    expect(GRADE_BAR_CLASS['=']).toBe('bg-red');
  });
});
