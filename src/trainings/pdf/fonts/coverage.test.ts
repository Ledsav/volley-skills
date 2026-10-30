// @vitest-environment node
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Catalog } from '../../../i18n/catalog';
import { en } from '../../../i18n/en';
import { it as itCatalog } from '../../../i18n/it';

/** The bit of fontkit (pdfkit's font engine, already inside pdfmake) this test uses. */
interface FontkitFont {
  hasGlyphForCodePoint(codePoint: number): boolean;
}
const require = createRequire(import.meta.url);
// fontkit comes with pdfmake, so resolve it from pdfmake's own location instead of relying on hoisting.
const fontkit = createRequire(require.resolve('pdfmake'))('fontkit') as { openSync(path: string): FontkitFont };
const open = (file: string) => fontkit.openSync(fileURLToPath(new URL(`./${file}`, import.meta.url)));
const fonts = { 'Inter-Regular.ttf': open('Inter-Regular.ttf'), 'Inter-SemiBold.ttf': open('Inter-SemiBold.ttf') };

/** Every string a catalog subtree can produce; functions are called with a spread of sample arguments. */
function strings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (typeof node === 'function') {
    const samples: unknown[][] = [[], [1], [2], [1, 'women'], [2, 'men'], [3, 'mixed'], ['women'], ['men'], ['mixed'], [10, 0, 10], [12, 8]];
    for (const args of samples) {
      try {
        const v = (node as (...a: unknown[]) => unknown)(...args);
        if (typeof v === 'string') out.push(v);
      } catch {
        /* not that signature */
      }
    }
  } else if (node && typeof node === 'object') Object.values(node).forEach((v) => strings(v, out));
  return out;
}

/** The catalog text that can reach the PDF: its own strings, category pills, team-notes levels and positions. */
const pdfText = (t: Catalog) =>
  strings([t.trainings.pdf, t.labels.exerciseCategory, t.labels.level, t.labels.position]).join('');

// Fixed text in buildTrainingPdf.ts (separators, slot numbers, minute ranges) and fontSafe's replacements.
const LAYOUT = '·#–,:()‹›';
// Names, notes and descriptions coaches type: accented Latin (Italian, French, German, Spanish, Polish,
// Czech, Romanian, Turkish, Nordic…), plus Greek and Cyrillic, typography and currency.
const TYPED =
  'Łukasz Dvořák · Nicolò · Zoë · Ştefan Ţurcanu · Șerban Țepeș · Ilaria Lanzoni · Ålesund Ørsted Æble · Gonçalo Muñoz · ' +
  'Jürgen Größe · Ġużeppi · Kateřina Šťastná · Đorđe Čavić · Oğuz Şahin İnce · Žaneta Ądam Ęło Śćź · Ő Ű ő ű · ' +
  'àèéìòùáíóúâêîôûãõñçäëïöüÿýœŒÀÉÈÌÒÙÁÍÓÚÂÊÎÔÛÃÕÑÇÄËÏÖÜŸÝ ß ðÐþÞ ĀāĒēĪīŌōŪū ' +
  'ЖжΩω Ωμέγα Жора ‘’“”«»„…•€%&@/\\+-=<>!?;"\'[]{}|*_~^$0123456789';

describe('vendored Inter glyph coverage', () => {
  const text = LAYOUT + TYPED + pdfText(en) + pdfText(itCatalog);
  const codePoints = [...new Set([...text].map((c) => c.codePointAt(0) as number))].filter((cp) => cp > 0x20);

  it('collects the PDF strings to check', () => {
    expect(pdfText(en)).toContain('Session plan');
    expect(pdfText(itCatalog)).toContain('Riscaldamento');
    expect(codePoints.length).toBeGreaterThan(150);
  });

  it.each(Object.entries(fonts))('%s covers every character the PDF can print', (_name, font) => {
    const missing = codePoints.filter((cp) => !font.hasGlyphForCodePoint(cp)).map((cp) => String.fromCodePoint(cp));
    expect(missing).toEqual([]);
  });
});
