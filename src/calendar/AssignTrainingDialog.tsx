import { useEffect, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { useSave } from '../components/useSave';
import { Input, Textarea } from '../components/Input';
import { DiagramThumbnail } from '../diagrams/DiagramThumbnail';
import { getExercisesByIds } from '../exercises/exercisesApi';
import { findTrainingByBusinessId, listTrainings } from '../trainings/trainingsApi';
import type { Training } from '../types/training';
import { createCalendarSession } from './calendarApi';
import { HealthHint } from '../components/HealthHint';
import { useT } from '../i18n/I18nProvider';

interface ExerciseRow {
  exerciseId: string;
  durationMinutes: number;
  name: string | null;
  description: string;
}

interface AssignTrainingDialogProps {
  teamId: string;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AssignTrainingDialog({ teamId, date, onClose, onSaved }: AssignTrainingDialogProps) {
  const t = useT();
  const { firebaseUser } = useAuth();
  const [sessionDate, setSessionDate] = useState(date);
  const [options, setOptions] = useState<Training[]>([]);
  const [optionsLastDoc, setOptionsLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [optionsHasMore, setOptionsHasMore] = useState(false);
  const [businessId, setBusinessId] = useState('');
  const [selected, setSelected] = useState<Training | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<ExerciseRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  useEffect(() => {
    setExpandedId(null);
    if (!selected) {
      setSelectedExercises([]);
      return;
    }
    let cancelled = false;
    void getExercisesByIds(selected.exercises.map((e) => e.exerciseId))
      .then((found) => {
        if (cancelled) return;
        const byId = new Map(found.map((ex) => [ex.id, ex]));
        setSelectedExercises(
          selected.exercises
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((e) => ({
              exerciseId: e.exerciseId,
              durationMinutes: e.durationMinutes,
              name: byId.get(e.exerciseId)?.name ?? null,
              description: byId.get(e.exerciseId)?.description ?? '',
            }))
        );
      })
      .catch(() => {
        if (!cancelled) setSelectedExercises([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    void listTrainings()
      .then((page) => {
        setOptions(page.trainings);
        setOptionsLastDoc(page.lastDoc);
        setOptionsHasMore(page.trainings.length > 0 && page.lastDoc !== null);
        setOptionsLoaded(true);
      })
      .catch(() => setError(t.calendar.assign.loadError));
  }, []);

  async function loadMoreOptions() {
    if (!optionsLastDoc) return;
    try {
      const page = await listTrainings(optionsLastDoc);
      setOptions((current) => [...current, ...page.trainings]);
      setOptionsLastDoc(page.lastDoc);
      setOptionsHasMore(page.trainings.length > 0 && page.lastDoc !== null);
    } catch {
      setError(t.calendar.assign.loadMoreError);
    }
  }

  async function searchByBusinessId() {
    if (!businessId.trim()) return;
    try {
      const found = await findTrainingByBusinessId(businessId.trim());
      setOptions(found ? [found] : []);
      setOptionsLastDoc(null);
      setOptionsHasMore(false);
      setSelected(found);
      setOptionsLoaded(true);
    } catch {
      setError(t.calendar.assign.searchError);
    }
  }

  const { saving, save } = useSave();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      setError(t.calendar.assign.pickTraining);
      return;
    }
    if (!firebaseUser) return;
    setError(null);
    try {
      const done = await save(() => createCalendarSession(
        teamId,
        {
          date: sessionDate,
          trainingId: selected.id,
          trainingBusinessId: selected.businessId,
          trainingName: selected.name,
          notes,
        },
        firebaseUser.uid
      ));
      if (!done) return;
      onSaved();
    } catch {
      setError(t.calendar.assign.assignError);
    }
  }

  return (
    <Sheet
      title={t.calendar.assign.title}
      onClose={onClose}
      detent="large"
      guardUnsaved
      confirm={{ label: saving ? t.calendar.assign.saving : t.calendar.assign.assign, form: 'assign-training-form', disabled: saving }}
    >
      <form id="assign-training-form" onSubmit={handleSubmit} aria-label={t.calendar.assign.title}>

        <label htmlFor="session-date" className="mb-1 block text-footnote text-ink-2">
          {t.calendar.assign.date}
        </label>
        <Input
          id="session-date"
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
        />

        <label htmlFor="session-bid" className="mb-1 mt-4 block text-footnote text-ink-2">
          {t.calendar.assign.findByBusinessId}
        </label>
        <div className="flex gap-2">
          <Input
            id="session-bid"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            placeholder="TR-0007"
          />
          <Button variant="secondary" size="sm" onClick={() => void searchByBusinessId()}>
            {t.calendar.assign.find}
          </Button>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-1 text-footnote text-ink-2">{t.calendar.assign.training}</legend>
          <ul className="overflow-hidden rounded-lg bg-surface-2">
            {optionsLoaded && options.length === 0 && (
              <li className="flex min-h-[52px] items-center px-4 text-callout text-ink-2">{t.calendar.assign.noneAvailable}</li>
            )}
            {options.map((training) => (
              <li
                key={training.id}
                className={`relative before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden ${
                  selected?.id === training.id ? 'bg-surface-3' : ''
                }`}
              >
                <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4 text-callout">
                  <input
                    type="radio"
                    name="training"
                    checked={selected?.id === training.id}
                    onChange={() => setSelected(training)}
                  />
                  <span className="tabular-nums text-ink-2">{training.businessId}</span>
                  <span className="text-headline text-ink">{training.name}</span>
                </label>
              </li>
            ))}
          </ul>
          {optionsHasMore && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadMoreOptions()}
              className="mt-2"
            >
              {t.calendar.assign.loadMore}
            </Button>
          )}
        </fieldset>

        {selected && selectedExercises.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-footnote text-ink-2">{t.calendar.assign.exercisesIn(selected.name)}</p>
            <ul aria-label={t.calendar.assign.exercisesLabel} className="overflow-hidden rounded-lg bg-surface-2">
              {selectedExercises.map((row) => {
                const expanded = expandedId === row.exerciseId;
                return (
                  <li
                    key={row.exerciseId}
                    className="relative px-3 py-2 before:absolute before:left-3 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={
                          row.name ? (expanded ? t.calendar.assign.collapse(row.name) : t.calendar.assign.expand(row.name)) : undefined
                        }
                        onClick={() => setExpandedId(expanded ? null : row.exerciseId)}
                        disabled={!row.name}
                        className="shrink-0 text-ink-3 hover:text-ink disabled:opacity-30"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                      <DiagramThumbnail
                        exerciseId={row.exerciseId}
                        className="aspect-square w-10 shrink-0 overflow-hidden rounded-sm border border-separator"
                      />
                      <span className={`min-w-0 flex-1 truncate text-callout ${row.name ? 'text-ink' : 'text-red-strong'}`}>
                        {row.name ?? (
                          <span className="inline-flex items-center gap-1">
                            <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                            {t.calendar.assign.deletedExercise}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-footnote tabular-nums text-ink-2">{t.calendar.assign.minutes(row.durationMinutes)}</span>
                    </div>
                    {expanded && (
                      <p className="mt-2 pl-6 text-footnote text-ink-2">{row.description || t.calendar.assign.noDescription}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <label htmlFor="session-notes" className="mb-1 mt-4 block text-footnote text-ink-2">
          {t.calendar.assign.notes}
        </label>
        <Textarea id="session-notes" aria-describedby="session-notes-hint" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <HealthHint id="session-notes-hint" />

        {error && (
          <p role="alert" className="mt-3 text-callout text-red-strong">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}
