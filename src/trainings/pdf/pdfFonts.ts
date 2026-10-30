import interRegularUrl from './fonts/Inter-Regular.ttf?url';
import interSemiBoldUrl from './fonts/Inter-SemiBold.ttf?url';

/**
 * The PDF's font: Inter 4.1 (static TTFs, SIL Open Font License, ./fonts/OFL.txt), the app's own
 * typeface. The files are same-origin assets fetched only when someone exports, because this module
 * is reached only through the lazy PDF import. Bold is SemiBold (600, like the app's headings);
 * there are no italic files, so italics map to the upright ones and the PDF never asks for italics.
 */
export const PDF_FONT = 'Inter';
export const PDF_FONT_FILES = {
  normal: 'Inter-Regular.ttf',
  bold: 'Inter-SemiBold.ttf',
  italics: 'Inter-Regular.ttf',
  bolditalics: 'Inter-SemiBold.ttf',
} as const;

const FONT_URLS: Record<string, string> = {
  'Inter-Regular.ttf': interRegularUrl,
  'Inter-SemiBold.ttf': interSemiBoldUrl,
};

/** Width in pt of regular-weight text at a font size (the shape buildTrainingPdf's `measure` takes). */
export type TextMeasure = (text: string, fontSize: number) => number;

export interface PdfFonts {
  /** pdfmake virtual file system: file name to base64. */
  vfs: Record<string, string>;
  /** Raw bytes per file name, for measuring. */
  bytes: Record<string, ArrayBuffer>;
}

async function fetchFontBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load the PDF font (${res.status})`);
  return res.arrayBuffer();
}

/** Base64 without blowing the argument limit of String.fromCharCode on 400 KB files. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Fetches both Inter files once; rejects when either fails, so no PDF is built with a fallback font. */
export async function loadPdfFonts(fetchBytes: (url: string) => Promise<ArrayBuffer> = fetchFontBytes): Promise<PdfFonts> {
  const names = Object.keys(FONT_URLS);
  const buffers = await Promise.all(names.map((name) => fetchBytes(FONT_URLS[name])));
  return {
    vfs: Object.fromEntries(names.map((name, i) => [name, toBase64(new Uint8Array(buffers[i]))])),
    bytes: Object.fromEntries(names.map((name, i) => [name, buffers[i]])),
  };
}

const MEASURE_FAMILY = 'VolleySkillsPdfInter';
const MEASURE_SIZE = 100;
let cachedMeasure: TextMeasure | undefined;

/**
 * Measures text with the real Inter Regular (the PDF's own bytes, through FontFace + canvas), so
 * category pills fit their labels exactly. Resolves undefined where the browser cannot do it (and in
 * tests); buildTrainingPdf then falls back to its conservative estimate.
 */
export async function browserTextMeasure(regular: ArrayBuffer): Promise<TextMeasure | undefined> {
  if (cachedMeasure) return cachedMeasure;
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return undefined;
  try {
    const face = await new FontFace(MEASURE_FAMILY, regular.slice(0)).load();
    document.fonts.add(face);
    const font = `${MEASURE_SIZE}px ${MEASURE_FAMILY}`;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx || !document.fonts.check(font)) return undefined;
    ctx.font = font;
    cachedMeasure = (text, fontSize) => (ctx.measureText(text).width * fontSize) / MEASURE_SIZE;
    return cachedMeasure;
  } catch {
    return undefined;
  }
}
