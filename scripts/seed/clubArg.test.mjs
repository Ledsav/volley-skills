import { describe, expect, it } from 'vitest';
import { assertProdClub, parseClubArg } from './clubArg.mjs';

describe('assertProdClub', () => {
  it('throws for --prod without --club', () => expect(() => assertProdClub(['--prod', '--yes'])).toThrow(/--club/));
  it('accepts --prod with --club', () => expect(() => assertProdClub(['--prod', '--club', 'x'])).not.toThrow());
  it('ignores the emulator', () => expect(() => assertProdClub(['--emulator'])).not.toThrow());
});

describe('parseClubArg', () => {
  it('defaults to demo', () => expect(parseClubArg(['--emulator'])).toBe('demo'));
  it('reads the value after --club', () => expect(parseClubArg(['--x', '--club', 'rival'])).toBe('rival'));
});
