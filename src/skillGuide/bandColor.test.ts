import { describe, expect, it } from 'vitest';
import { bandBorderClass } from './bandColor';

describe('bandBorderClass', () => {
  it('maps the 1-3 (Beginner) range to red', () => {
    expect(bandBorderClass(1)).toBe('border-red');
  });

  it('maps the 4-6 (Developing) range to orange', () => {
    expect(bandBorderClass(4)).toBe('border-orange');
  });

  it('maps the 7-8 (Advanced) range to blue', () => {
    expect(bandBorderClass(7)).toBe('border-blue');
  });

  it('maps the 9-10 (Elite) range to green', () => {
    expect(bandBorderClass(9)).toBe('border-green');
  });
});
