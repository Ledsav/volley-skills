// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decodeDvw } from './decodeDvw';

/** Bytes of ASCII strings mixed with raw byte values (for non-UTF-8 encodings). */
function bytes(parts: (string | number)[]): ArrayBuffer {
  const out: number[] = [];
  for (const p of parts) {
    if (typeof p === 'number') out.push(p);
    else for (const ch of p) out.push(ch.charCodeAt(0));
  }
  return new Uint8Array(out).buffer;
}

describe('decodeDvw', () => {
  it('decodes UTF-8', () => {
    const buf = new TextEncoder().encode('[3MATCH]\n01/02/2026;;;;;;;;1252;2\nMüller;Pérez').buffer;
    const text = decodeDvw(buf);
    expect(text).toContain('Müller');
    expect(text).toContain('Pérez');
  });

  it('decodes windows-1252 when UTF-8 is invalid', () => {
    // ü = 0xFC, é = 0xE9 in windows-1252 (invalid UTF-8 here)
    const buf = bytes(['[3MATCH]\n01/02/2026;;;;;;;;1252;2\nM', 0xfc, 'ller;P', 0xe9, 'rez']);
    const text = decodeDvw(buf);
    expect(text).toContain('Müller');
    expect(text).toContain('Pérez');
  });

  it('defaults to windows-1252 when no code page is declared', () => {
    const buf = bytes(['no sections here, M', 0xfc, 'ller']);
    expect(decodeDvw(buf)).toContain('Müller');
  });

  it('uses the code page declared in [3MATCH]', () => {
    // ř = 0xF8 in windows-1250 (ø in windows-1252)
    const buf = bytes(['[3MATCH]\n01/02/2026;;;;;;;;1250;2\nD', 0xf8, 'evo']);
    expect(decodeDvw(buf)).toContain('Dřevo');
  });
});
