import { describe, expect, it } from 'vitest';
import { PHYSICAL_TEST_ORDER, visibleTestTypes } from './physicalTest';

describe('visibleTestTypes', () => {
  it('excludes growth when growth tests are off', () => {
    const types = visibleTestTypes(false);
    expect(types).not.toContain('growth');
    expect(types).toEqual(PHYSICAL_TEST_ORDER.filter((t) => t !== 'growth'));
  });

  it('equals PHYSICAL_TEST_ORDER when on', () => {
    expect(visibleTestTypes(true)).toEqual(PHYSICAL_TEST_ORDER);
  });
});
