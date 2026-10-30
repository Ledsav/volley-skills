import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserTextMeasure, loadPdfFonts, PDF_FONT_FILES, toBase64 } from './pdfFonts';

describe('pdfFonts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads both font files once and stores them as base64', async () => {
    const fetchBytes = vi.fn(() => Promise.resolve(new Uint8Array([0, 1, 2]).buffer));
    const fonts = await loadPdfFonts(fetchBytes);
    expect(fonts.vfs).toEqual({ 'Inter-Regular.ttf': 'AAEC', 'Inter-SemiBold.ttf': 'AAEC' });
    expect(fetchBytes).toHaveBeenCalledTimes(2);
    const urls = fetchBytes.mock.calls.map((c) => (c as unknown[])[0] as string);
    expect(new Set(urls).size).toBe(2);
    expect(urls[0]).toMatch(/Inter-Regular.*\.ttf/);
    expect(urls[1]).toMatch(/Inter-SemiBold.*\.ttf/);
  });

  it('a failed font response rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadPdfFonts()).rejects.toThrow('404');
  });

  it('maps bold to SemiBold and italics to the upright files', () => {
    expect(PDF_FONT_FILES).toEqual({
      normal: 'Inter-Regular.ttf',
      bold: 'Inter-SemiBold.ttf',
      italics: 'Inter-Regular.ttf',
      bolditalics: 'Inter-SemiBold.ttf',
    });
  });

  it('encodes large files in chunks', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(atob(toBase64(bytes)).length).toBe(100_000);
    expect(toBase64(new TextEncoder().encode('Inter'))).toBe(btoa('Inter'));
  });

  it('leaves measuring to the estimate where the browser cannot load a FontFace', async () => {
    expect(await browserTextMeasure(new ArrayBuffer(4))).toBeUndefined();
  });

  // Last: a successful measure is cached for the session.
  it('measures with the loaded font on a canvas, scaled to the font size', async () => {
    const add = vi.fn();
    const families: string[] = [];
    vi.stubGlobal(
      'FontFace',
      class {
        constructor(family: string) {
          families.push(family);
        }
        load() {
          return Promise.resolve(this);
        }
      },
    );
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add, check: () => true } });
    const ctx = { font: '', measureText: (s: string) => ({ width: s.length * 60 }) };
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    try {
      const measure = await browserTextMeasure(new ArrayBuffer(4));
      expect(add).toHaveBeenCalledTimes(1);
      expect(ctx.font).toBe(`100px ${families[0]}`);
      expect(families[0]).not.toBe('Inter'); // never shadows the app's own Inter
      expect(measure?.('Game', 8)).toBeCloseTo(4 * 60 * 0.08);
    } finally {
      getContext.mockRestore();
      delete (document as { fonts?: unknown }).fonts;
    }
  });
});
