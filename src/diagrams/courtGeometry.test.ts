import { describe, expect, it } from 'vitest';
import { courtGeometry } from './courtGeometry';

describe('courtGeometry', () => {
  it('full court: net across the middle', () => {
    expect(courtGeometry('full')).toEqual({ left: 10, right: 90, top: 6, bottom: 94, netY: 50 });
  });
  it('half court: net along the top edge', () => {
    expect(courtGeometry('half')).toEqual({ left: 10, right: 90, top: 6, bottom: 72, netY: 6 });
  });
});
