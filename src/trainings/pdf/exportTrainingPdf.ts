import { getT } from '../../i18n/I18nProvider';
import { listDiagrams } from '../../diagrams/diagramsApi';
import { getExercisesByIds } from '../../exercises/exercisesApi';
import type { Diagram } from '../../types/diagram';
import type { Training } from '../../types/training';
import { buildTrainingDocDefinition, trainingPdfFileName, type TeamNotes } from './buildTrainingPdf';
import { diagramToPdfSvg } from './diagramToPdfSvg';

/** The UMD builds come through as either the namespace itself or its `default`. */
function interop<T>(mod: T): T {
  return (mod as { default?: T }).default ?? mod;
}

/**
 * Builds the shareable PDF of a training: reads its exercises and their court
 * diagrams, lays them out, and renders with pdfmake (lazy-loaded, its own chunk).
 */
export async function generateTrainingPdf(training: Training, teamNotes?: TeamNotes): Promise<File> {
  const ids = [...new Set(training.exercises.map((e) => e.exerciseId))];
  const [exercises, pdfMakeModule, vfsModule] = await Promise.all([
    getExercisesByIds(ids),
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const exercisesById = new Map(exercises.map((ex) => [ex.id, ex]));
  const diagramLists = await Promise.all(exercises.map((ex) => listDiagrams(ex.id)));
  const diagramsById = new Map<string, Diagram[]>(exercises.map((ex, i) => [ex.id, diagramLists[i]]));

  const pdfMake = interop(pdfMakeModule);
  pdfMake.addVirtualFileSystem(vfsModule.default);
  pdfMake.setUrlAccessPolicy(() => false); // everything is inline: no remote fonts or images
  const definition = buildTrainingDocDefinition({
    t: getT(),
    training,
    teamNotes,
    exercisesById,
    diagramsById,
    svgFor: (d) => diagramToPdfSvg(d.scene),
  });
  const blob = await pdfMake.createPdf(definition).getBlob();
  return new File([blob], trainingPdfFileName(training, teamNotes?.date), { type: 'application/pdf' });
}
