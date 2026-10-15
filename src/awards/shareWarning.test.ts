// src/awards/shareWarning.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markShareWarned, needsShareWarning } from './shareWarning';

describe('shareWarning', () => {
  afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });
  it('warns once per session', () => {
    expect(needsShareWarning()).toBe(true);
    markShareWarned();
    expect(needsShareWarning()).toBe(false);
  });
  it('still warns when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(needsShareWarning()).toBe(true);
  });
});
