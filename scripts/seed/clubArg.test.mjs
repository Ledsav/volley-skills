import { describe, expect, it } from 'vitest';
import { parseClubArg } from './clubArg.mjs';

describe('parseClubArg', () => {
  it('defaults to demo', () => expect(parseClubArg(['--emulator'])).toBe('demo'));
  it('reads the value after --club', () => expect(parseClubArg(['--x', '--club', 'rival'])).toBe('rival'));
});
