import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { DiagramSvg } from '../diagrams/DiagramSvg';
import { listDiagrams } from '../diagrams/diagramsApi';
import { sceneAsDiagram } from '../diagrams/sceneFactory';
import type { Diagram, Scene } from '../types/diagram';
import { useT } from '../i18n/I18nProvider';
import type { ExerciseCategory } from '../types/exercise';

const SWIPE_PX = 50;

export interface ExerciseDetailEntry {
  exerciseId: string;
  /** null => the exercise no longer exists. */
  name: string | null;
  description: string;
  category?: ExerciseCategory;
  /** Set when the exercise is shown as a step of a training. */
  durationMinutes?: number;
  minPlayers?: number;
  /** An unsaved (AI draft) diagram: rendered as is, nothing is fetched. `null` => draft without a diagram. */
  scene?: Scene | null;
}

interface ExerciseDetailSheetProps {
  entries: ExerciseDetailEntry[];
  startIndex: number;
  onClose: () => void;
}

/**
 * Read-only, full-screen-on-mobile view of one exercise (all its diagrams at
 * full width + the description). With several entries — the exercises of a
 * training — it steps through them in order with Previous / Next, arrow keys,
 * or a horizontal swipe on the diagram.
 */
export function ExerciseDetailSheet({ entries, startIndex, onClose }: ExerciseDetailSheetProps) {
  const t = useT();
  const lb = t.labels;
  const d = t.exercises.detail;
  const [index, setIndex] = useState(startIndex);
  const [diagramIndex, setDiagramIndex] = useState(0);
  // Per-exercise diagram cache so stepping back and forth doesn't refetch.
  const [diagramsById, setDiagramsById] = useState<Record<string, Diagram[] | 'error'>>({});
  const touchStartX = useRef<number | null>(null);

  const entry = entries[index];
  const total = entries.length;
  const diagrams: Diagram[] | 'error' | undefined =
    entry && entry.scene !== undefined
      ? entry.scene
        ? [sceneAsDiagram(entry.exerciseId, entry.scene)]
        : []
      : entry
        ? diagramsById[entry.exerciseId]
        : undefined;
  const diagramList = Array.isArray(diagrams) ? diagrams : [];
  const currentDiagram = diagramList[diagramIndex] ?? null;

  const startMinute = entries.slice(0, index).reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
  const isTrainingStep = entry?.durationMinutes !== undefined;

  useEffect(() => {
    if (!entry || !entry.name || entry.scene !== undefined || entry.exerciseId in diagramsById) return;
    const id = entry.exerciseId;
    let cancelled = false;
    listDiagrams(id)
      .then((found) => {
        if (!cancelled) setDiagramsById((cur) => ({ ...cur, [id]: found }));
      })
      .catch(() => {
        if (!cancelled) setDiagramsById((cur) => ({ ...cur, [id]: 'error' }));
      });
    return () => {
      cancelled = true;
    };
  }, [entry, diagramsById]);

  function goTo(next: number) {
    if (next < 0 || next >= total) return;
    setIndex(next);
    setDiagramIndex(0);
  }

  function stepDiagram(delta: number) {
    if (diagramList.length < 2) return;
    setDiagramIndex((n) => (n + delta + diagramList.length) % diagramList.length);
  }

  // Arrow keys step between exercises (diagrams have their own buttons).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(index + 1);
      if (e.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total]);

  if (!entry) return null;

  const prev = index > 0 ? entries[index - 1] : null;
  const next = index < total - 1 ? entries[index + 1] : null;

  return (
    <Sheet
      variant="view"
      title={entry.name ?? d.deleted}
      onClose={onClose}
      size="lg"
      detent="large"
      footer={
        total > 1 ? (
          <div className="grid w-full grid-cols-2 gap-3">
            <Button
              variant="secondary"
              onClick={() => goTo(index - 1)}
              disabled={!prev}
              aria-label={d.previousExercise}
              className="min-w-0 justify-start gap-1"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{prev ? (prev.name ?? d.deleted) : d.previous}</span>
            </Button>
            <Button
              variant="primary"
              onClick={() => goTo(index + 1)}
              disabled={!next}
              aria-label={d.nextExercise}
              className="min-w-0 justify-end gap-1"
            >
              <span className="truncate">{next ? (next.name ?? d.deleted) : d.next}</span>
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-footnote text-ink-2">
          {total > 1 && (
            <span className="font-medium tabular-nums text-ink-2">
              {d.position(index + 1, total)}
            </span>
          )}
          {entry.category && (
            <span className="rounded-full bg-surface-3 px-2.5 text-caption text-ink-2">
              {lb.exerciseCategory[entry.category]}
            </span>
          )}
          {isTrainingStep && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2.5 text-caption tabular-nums text-ink-2">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {d.minutes(entry.durationMinutes ?? 0, startMinute, startMinute + (entry.durationMinutes ?? 0))}
            </span>
          )}
          {entry.minPlayers !== undefined && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2.5 text-caption tabular-nums text-ink-2">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {d.minPlayers(entry.minPlayers)}
            </span>
          )}
        </div>

        {!entry.name ? (
          <p className="text-callout text-red-strong">{d.wasDeleted}</p>
        ) : (
          <>
            <section aria-label={d.diagrams}>
              {diagrams === undefined && (
                <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-surface-2 text-callout text-ink-2">
                  {d.loadingDiagrams}
                </div>
              )}
              {diagrams === 'error' && <p className="text-callout text-red-strong">{d.diagramsError}</p>}
              {Array.isArray(diagrams) && diagrams.length === 0 && (
                <p className="rounded-lg bg-surface-2 p-4 text-center text-callout text-ink-2">
                  {d.noDiagrams}
                </p>
              )}
              {currentDiagram && (
                <figure>
                  <div
                    className="mx-auto aspect-square w-full max-w-[min(100%,70vh)] touch-pan-y overflow-hidden rounded-lg bg-surface-2"
                    onTouchStart={(e) => {
                      touchStartX.current = e.touches[0]?.clientX ?? null;
                    }}
                    onTouchEnd={(e) => {
                      const start = touchStartX.current;
                      touchStartX.current = null;
                      const end = e.changedTouches[0]?.clientX;
                      if (start === null || end === undefined) return;
                      if (end - start > SWIPE_PX) stepDiagram(-1);
                      else if (start - end > SWIPE_PX) stepDiagram(1);
                    }}
                  >
                    <DiagramSvg scene={currentDiagram.scene} />
                  </div>
                  <figcaption className="mt-2 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-callout font-medium text-ink">{currentDiagram.title}</span>
                    {diagramList.length > 1 && (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={t.diagrams.nav.previous}
                          onClick={() => stepDiagram(-1)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <span className="text-footnote tabular-nums text-ink-2">
                          {diagramIndex + 1} / {diagramList.length}
                        </span>
                        <button
                          type="button"
                          aria-label={t.diagrams.nav.next}
                          onClick={() => stepDiagram(1)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </span>
                    )}
                  </figcaption>
                </figure>
              )}
            </section>

            <section aria-label={d.description}>
              <h3 className="mb-1 text-title-3 text-ink">{d.description}</h3>
              <p className="whitespace-pre-wrap text-body text-ink">
                {entry.description || <span className="text-ink-2">{d.noDescription}</span>}
              </p>
            </section>
          </>
        )}
      </div>
    </Sheet>
  );
}
