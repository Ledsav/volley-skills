// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sha256OfBytes } from './sha256';

describe('sha256OfBytes', () => {
  it('hashes abc to the known lowercase hex digest', async () => {
    const bytes = new TextEncoder().encode('abc').buffer as ArrayBuffer;
    expect(await sha256OfBytes(bytes)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
