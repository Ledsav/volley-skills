// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { it as itCatalog } from '../../i18n/it';

/** The bits of fontkit (pdfkit's font engine, already inside pdfmake) this test uses. */
interface FontkitFont {
  unitsPerEm: number;
  layout(text: string): { advanceWidth: number };
}
interface Fontkit {
  openSync(path: string): FontkitFont;
}

const require = createRequire(import.meta.url);
const fontkit = require('fontkit') as Fontkit;
const roboto = fontkit.openSync(require.resolve('pdfmake/build/fonts/Roboto/Roboto-Regular.ttf'));
const widthAt8 = (s: string) => (roboto.layout(s).advanceWidth / roboto.unitsPerEm) * 8;

// buildTrainingPdf.ts sizes a pill at ceil(0.56 em × 8 pt × length) + 11 (5 pt padding each side, plus 1)
// and prints the label 5 pt in. 0.56 is an estimate, not an upper bound: some labels measure wider.
const pillWidth = (s: string) => Math.ceil(s.length * 8 * 0.56) + 11;
const COVER_CATEGORY_COLUMN = 72;

describe('category pills against the PDF font (Roboto Regular, 8 pt)', () => {
  const labels = [...Object.values(en.labels.exerciseCategory), ...Object.values(itCatalog.labels.exerciseCategory)];

  it('has labels to check', () => {
    expect(labels.length).toBe(18);
  });

  it.each(labels)('"%s" fits inside its pill without wrapping', (label) => {
    expect(widthAt8(label)).toBeLessThanOrEqual(pillWidth(label) - 5);
  });

  it.each(labels)('"%s" keeps its pill inside the cover Category column', (label) => {
    expect(pillWidth(label)).toBeLessThanOrEqual(COVER_CATEGORY_COLUMN);
  });
});
