// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sha256Hex } from './hash';
import { substitutePlaceholders } from './legalDocs';
import { OPERATOR } from './operator';

describe('sha256Hex', () => {
  it('hashes known input', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('differs when the address differs', async () => {
    const t = 'Seat: {{OPERATOR_ADDRESS}}';
    const a = await sha256Hex(substitutePlaceholders(t, 'en', { ...OPERATOR, address: null }));
    const b = await sha256Hex(substitutePlaceholders(t, 'en', { ...OPERATOR, address: '1 Rue X' }));
    expect(a).not.toBe(b);
  });
});
