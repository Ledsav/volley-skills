import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Clock, FileDown, Pencil, Play, Share2, TriangleAlert, Users } from 'lucide-react';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { useNotify } from '../components/Notice';
import { shareOrDownload } from '../export/shareFile';
import { DiagramThumbnail } from '../diagrams/DiagramThumbnail';
import { ExerciseDetailSheet, type ExerciseDetailEntry } from '../exercises/ExerciseDetailSheet';
import { getExercisesByIds } from '../exercises/exercisesApi';
import type { Training } from '../types/training';
import type { TeamNotes } from './pdf/buildTrainingPdf';
import { TeamNotesDialog, type TeamNotesDraft } from './TeamNotesDialog';
import { useT } from '../i18n/I18nProvider';

interface TrainingViewSheetProps {
  training: Training;
  /** Set when opened from a team's calendar session: the PDF export then adds team notes. */
  teamContext?: { teamId: string; date: string; notes: string };
  /** Start building the PDF on open (the "Export PDF" row action). Sharing still takes the "Share PDF ready" tap. */
  autoBuildPdf?: boolean;
  onClose: () => void;
  onEdit: () => void;
}

/**
 * Read-only view of a training for use at practice: the ordered exercise plan
 * with time slots, each opening full-screen, and "Start" to step through the
 * whole session from the first exercise. Editing is one tap away via "Edit".
 */
export function TrainingViewSheet({ training, teamContext, autoBuildPdf, onClose, onEdit }: TrainingViewSheetProps) {
  const t = useT();
  const lb = t.labels;
  const v = t.trainings.view;
  const [entries, setEntries] = useState<ExerciseDetailEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  // Two taps: browsers only open the share sheet straight after a tap, and building takes too long for that.
  const [pdf, setPdf] = useState<File | 'building' | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const notify = useNotify();
  const [askingNotes, setAskingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState<TeamNotesDraft | undefined>(undefined);

  async function buildPdf(teamNotes?: TeamNotes) {
    setPdf('building');
    setPdfError(null);
    try {
      // Lazy: the PDF code (pdfmake + fonts) is its own chunk, loaded only when someone exports.
      const { generateTrainingPdf } = await import('./pdf/exportTrainingPdf');
      setPdf(await generateTrainingPdf(training, teamNotes));
    } catch {
      setPdf(null);
      setPdfError(v.pdfError);
    }
  }

  async function sharePdf(file: File) {
    const result = await shareOrDownload([file], training.name);
    if (result === 'downloaded') notify(v.pdfDownloaded);
  }

  useEffect(() => {
    const ordered = training.exercises.slice().sort((a, b) => a.order - b.order);
    let cancelled = false;
    setPdf(null); // a built PDF belongs to the training it was built from
    getExercisesByIds(ordered.map((e) => e.exerciseId))
      .then((found) => {
        if (cancelled) return;
        const byId = new Map(found.map((ex) => [ex.id, ex]));
        setEntries(
          ordered.map((e) => {
            const ex = byId.get(e.exerciseId);
            return {
              exerciseId: e.exerciseId,
              name: ex?.name ?? null,
              description: ex?.description ?? '',
              category: ex?.category,
              durationMinutes: e.durationMinutes,
              minPlayers: ex?.minPlayers,
            };
          })
        );
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [training]);

  // Declared after the effect above, which resets the PDF on mount.
  const autoBuilt = useRef(false);
  useEffect(() => {
    if (!autoBuildPdf || teamContext || autoBuilt.current) return;
    autoBuilt.current = true;
    void buildPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalMinutes = useMemo(
    () => training.exercises.reduce((sum, e) => sum + (e.durationMinutes || 0), 0),
    [training]
  );
  const exerciseCount = training.exercises.length;

  return (
    <Sheet
      variant="view"
      title={`${training.businessId} · ${training.name}`}
      size="lg"
      detent="large"
      onClose={onClose}
      footer={
        // Phones: the PDF action gets its own row, so "Share PDF ready" (or a longer Italian label) never wraps
        // inside a third of the width; Edit and Start share the row below.
        <div className="flex w-full flex-wrap items-center gap-3 sm:flex-nowrap">
          {pdf instanceof File ? (
            <Button variant="secondary" onClick={() => void sharePdf(pdf)} className="w-full gap-1.5 whitespace-nowrap sm:mr-auto sm:w-auto">
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {v.sharePdfReady}
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => (teamContext ? setAskingNotes(true) : void buildPdf())}
              disabled={pdf === 'building'}
              className="w-full gap-1.5 whitespace-nowrap sm:mr-auto sm:w-auto"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              {pdf === 'building' ? v.preparingPdf : v.sharePdf}
            </Button>
          )}
          <Button variant="secondary" onClick={onEdit} className="flex-1 gap-1.5 sm:flex-none">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {v.edit}
          </Button>
          <Button
            variant="primary"
            onClick={() => setViewing(0)}
            disabled={!entries || entries.length === 0}
            className="flex-1 gap-1.5 sm:flex-none"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {v.start}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-footnote text-ink-2">
          {training.ageGroupTarget && (
            <span className="rounded-full bg-surface-3 px-2.5 text-caption text-ink-2">
              {training.ageGroupTarget}
            </span>
          )}
          <span className="inline-flex items-center gap-1 tabular-nums text-ink-2">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {v.summary(exerciseCount, totalMinutes)}
          </span>
          {training.suggestedPlayers !== undefined && (
            <span className="inline-flex items-center gap-1 tabular-nums text-ink-2">
              <Users className="h-4 w-4" aria-hidden="true" />
              {v.players(training.suggestedPlayers)}
            </span>
          )}
        </div>

        {training.targets && training.targets.length > 0 && (
          <ul aria-label={v.targets} className="-mt-2 flex flex-wrap gap-2">
            {training.targets.map((target) => (
              <li key={target} className="rounded-full bg-surface-3 px-2.5 text-caption text-ink-2">
                {lb.exerciseCategory[target]}
              </li>
            ))}
          </ul>
        )}

        {training.description && (
          <p className="whitespace-pre-wrap text-body text-ink">{training.description}</p>
        )}

        {loadFailed && (
          <p role="alert" className="text-callout text-red-strong">
            {v.loadError}
          </p>
        )}

        {pdfError && (
          <p role="alert" className="text-callout text-red-strong">
            {pdfError}
          </p>
        )}

        {teamContext && pdf instanceof File && (
          <button
            type="button"
            onClick={() => setAskingNotes(true)}
            className="inline-flex min-h-11 items-center self-start rounded-sm text-callout font-medium text-ink underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {v.editTeamNotes}
          </button>
        )}

        {/* The share button is disabled while building, so focus can't carry the news: announce it. */}
        <p data-testid="pdf-status" aria-live="polite" className="sr-only">
          {pdf === 'building' ? v.pdfStatusBuilding : pdf instanceof File ? v.pdfStatusReady : ''}
        </p>

        {!entries && !loadFailed && <p className="text-callout text-ink-2">{v.loadingExercises}</p>}

        {entries && (
          <ol aria-label={v.plan} className="rounded-lg bg-surface-2">
            {entries.length === 0 && <li className="p-3 text-callout text-ink-2">{v.noExercises}</li>}
            {entries.map((entry, i) => {
              const start = entries.slice(0, i).reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
              const end = start + (entry.durationMinutes ?? 0);
              return (
                <li
                  key={`${entry.exerciseId}-${i}`}
                  className="relative before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden"
                >
                  <button
                    type="button"
                    onClick={() => setViewing(i)}
                    aria-label={v.viewExercise(i + 1, entry.name)}
                    className="flex min-h-[60px] w-full items-center gap-3 px-3 py-2 text-left active:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-caption font-semibold tabular-nums text-ink">
                      {i + 1}
                    </span>
                    <DiagramThumbnail
                      exerciseId={entry.exerciseId}
                      interactive={false}
                      className="aspect-square w-16 shrink-0 overflow-hidden rounded-sm bg-surface"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-headline ${entry.name ? 'text-ink' : 'text-red-strong'}`}
                      >
                        {entry.name ?? (
                          <span className="inline-flex items-center gap-1">
                            <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                            {v.deletedExercise}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-footnote tabular-nums text-ink-2">
                        {entry.category ? `${lb.exerciseCategory[entry.category]} · ` : ''}
                        {v.exerciseTiming(entry.durationMinutes ?? 0, start, end)}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-ink-3" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {askingNotes && teamContext && (
        <TeamNotesDialog
          teamId={teamContext.teamId}
          date={teamContext.date}
          initialGeneral={teamContext.notes}
          draft={notesDraft}
          onCancel={() => setAskingNotes(false)}
          onConfirm={(notes, draft) => {
            setNotesDraft(draft);
            setAskingNotes(false);
            void buildPdf(notes);
          }}
        />
      )}

      {viewing !== null && entries && (
        <ExerciseDetailSheet entries={entries} startIndex={viewing} onClose={() => setViewing(null)} />
      )}
    </Sheet>
  );
}
