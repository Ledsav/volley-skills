// @vitest-environment node
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { it as itCatalog } from '../../i18n/it';
import type { Exercise } from '../../types/exercise';
import type { Training } from '../../types/training';
import { buildTrainingDocDefinition } from './buildTrainingPdf';

/** The bits of fontkit (pdfkit's font engine, already inside pdfmake) this test uses. */
interface FontkitFont {
  unitsPerEm: number;
  layout(text: string): { advanceWidth: number };
}
interface Fontkit {
  openSync(path: string): FontkitFont;
}

const require = createRequire(import.meta.url);
// fontkit comes with pdfmake, so resolve it from pdfmake's own location instead of relying on hoisting.
const fontkit = createRequire(require.resolve('pdfmake'))('fontkit') as Fontkit;
// Pill labels are regular weight (buildTrainingPdf.ts `chip`), so they are measured with the vendored Inter Regular.
const inter = fontkit.openSync(fileURLToPath(new URL('./fonts/Inter-Regular.ttf', import.meta.url)));
const interAt8: (s: string) => number = (s) => (inter.layout(s).advanceWidth / inter.unitsPerEm) * 8;

// buildTrainingPdf.ts sizes a pill at ceil(measure(label, 8 pt)) + 11 (5 pt padding each side, plus 1)
// and prints the label 5 pt in. The export measures with the real Inter; tests use the 0.7 em estimate.
const pillWidth = (s: string, measure: (s: string) => number) => Math.ceil(measure(s)) + 11;
const estimateAt8 = (s: string) => s.length * 8 * 0.7;
// Cover table Category column: 80 pt wide minus pdfmake's default 4 pt cell padding on each side.
const COVER_CATEGORY_COLUMN = 72;

describe('category pills against the PDF font (Inter Regular, 8 pt)', () => {
  const labels = [...Object.values(en.labels.exerciseCategory), ...Object.values(itCatalog.labels.exerciseCategory)];

  it('has labels to check', () => {
    expect(labels.length).toBe(18);
  });

  it.each(labels)('"%s" fits inside its pill without wrapping', (label) => {
    expect(interAt8(label)).toBeLessThanOrEqual(pillWidth(label, interAt8) - 5);
  });

  it.each(labels)('"%s" keeps its pill inside the cover Category column', (label) => {
    expect(pillWidth(label, interAt8)).toBeLessThanOrEqual(COVER_CATEGORY_COLUMN);
  });

  it.each(labels)('"%s" is never wider than the fallback estimate', (label) => {
    expect(interAt8(label)).toBeLessThanOrEqual(estimateAt8(label));
  });

  it('the builder uses that estimate when no measure is passed', () => {
    const training = {
      id: 't',
      businessId: 'TR-1',
      name: 'x',
      description: '',
      ageGroupTarget: '',
      exercises: [{ exerciseId: 'a', order: 1, durationMinutes: 5 }],
      exerciseIds: ['a'],
      createdBy: 'x',
      createdAt: null,
    } as Training;
    const exercise: Exercise = { id: 'a', name: 'x', description: '', category: 'service', createdBy: 'x', createdAt: null };
    const def = buildTrainingDocDefinition({ t: en, training, exercisesById: new Map([['a', exercise]]), diagramsById: new Map(), svgFor: () => '' });
    expect(JSON.stringify(def.content)).toContain(`"w":${pillWidth('Service', estimateAt8)}`);
  });
});
