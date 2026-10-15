// src/awards/story/storyPref.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStoryPref, writeStoryPref } from './storyPref';

describe('storyPref', () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('defaults to on and round-trips', () => {
    expect(readStoryPref()).toBe(true);
    writeStoryPref(false);
    expect(readStoryPref()).toBe(false);
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readStoryPref()).toBe(true);
  });
});
