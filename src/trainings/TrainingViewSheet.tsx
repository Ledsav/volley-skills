import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Clock, Pencil, Play, TriangleAlert } from 'lucide-react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { DiagramThumbnail } from '../diagrams/DiagramThumbnail';
import { ExerciseDetailSheet, type ExerciseDetailEntry } from '../exercises/ExerciseDetailSheet';
import { getExercisesByIds } from '../exercises/exercisesApi';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../types/exercise';
import type { Training } from '../types/training';

const CATEGORY_LABEL = Object.fromEntries(EXERCISE_CATEGORIES.map((c) => [c.key, c.label])) as Record<
  ExerciseCategory,
  string
>;

interface TrainingViewSheetProps {
  training: Training;
  onClose: () => void;
  onEdit: () => void;
}

/**
 * Read-only view of a training for use at practice: the ordered exercise plan
 * with time slots, each opening full-screen, and "Start" to step through the
 * whole session from the first exercise. Editing is one tap away via "Edit".
 */
export function TrainingViewSheet({ training, onClose, onEdit }: TrainingViewSheetProps) {
  const [entries, setEntries] = useState<ExerciseDetailEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  useEffect(() => {
    const ordered = training.exercises.slice().sort((a, b) => a.order - b.order);
    let cancelled = false;
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
            };
          })
        );
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the exercises for this training. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [training]);

  const totalMinutes = useMemo(
    () => training.exercises.reduce((sum, e) => sum + (e.durationMinutes || 0), 0),
    [training]
  );
  const exerciseCount = training.exercises.length;

  return (
    <Dialog
      title={`${training.businessId} · ${training.name}`}
      size="lg"
      mobileSheet
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onEdit} className="flex-1 gap-1.5 sm:flex-none">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Button>
          <Button
            variant="primary"
            onClick={() => setViewing(0)}
            disabled={!entries || entries.length === 0}
            className="flex-1 gap-1.5 sm:flex-none"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            Start
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {training.ageGroupTarget && (
            <span className="rounded-sm bg-blue/10 px-1.5 py-0.5 text-xs font-medium text-blue">
              {training.ageGroupTarget}
            </span>
          )}
          <span className="inline-flex items-center gap-1 tabular-nums text-slate">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'} · {totalMinutes} min
          </span>
        </div>

        {training.description && (
          <p className="whitespace-pre-wrap text-base leading-relaxed text-ink">{training.description}</p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red">
            {error}
          </p>
        )}

        {!entries && !error && <p className="text-sm text-slate">Loading exercises…</p>}

        {entries && (
          <ol aria-label="Training plan" className="divide-y divide-border rounded-md border border-border">
            {entries.length === 0 && <li className="p-3 text-sm text-slate">No exercises in this training.</li>}
            {entries.map((entry, i) => {
              const start = entries.slice(0, i).reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
              const end = start + (entry.durationMinutes ?? 0);
              return (
                <li key={`${entry.exerciseId}-${i}`}>
                  <button
                    type="button"
                    onClick={() => setViewing(i)}
                    aria-label={`View exercise ${i + 1}: ${entry.name ?? 'deleted exercise'}`}
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold tabular-nums text-white">
                      {i + 1}
                    </span>
                    <DiagramThumbnail
                      exerciseId={entry.exerciseId}
                      interactive={false}
                      className="aspect-square w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-surface"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-medium ${entry.name ? 'text-ink' : 'text-red'}`}
                      >
                        {entry.name ?? (
                          <span className="inline-flex items-center gap-1">
                            <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                            Deleted exercise
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs tabular-nums text-slate">
                        {entry.category ? `${CATEGORY_LABEL[entry.category]} · ` : ''}
                        {entry.durationMinutes} min · min {start}–{end}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {viewing !== null && entries && (
        <ExerciseDetailSheet entries={entries} startIndex={viewing} onClose={() => setViewing(null)} />
      )}
    </Dialog>
  );
}
