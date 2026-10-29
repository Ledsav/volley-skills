import { useEffect, useState, type FormEvent } from 'react';
import { Check, ChevronDown, ChevronRight, Search, TriangleAlert } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { useSave } from '../components/useSave';
import { FieldLabel, Input, Textarea } from '../components/Input';
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
  const [query, setQuery] = useState('');
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

  // One search field over the list: it filters the loaded trainings by name or business ID, and an ID that is not
  // loaded yet can still be looked up directly.
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.name.toLowerCase().includes(q) || o.businessId.toLowerCase().includes(q)) : options;

  async function lookUpBusinessId() {
    const id = query.trim();
    if (!id) return;
    try {
      const found = await findTrainingByBusinessId(id.toUpperCase());
      if (found) {
        setOptions((current) => (current.some((o) => o.id === found.id) ? current : [found, ...current]));
        setSelected(found);
      } else {
        setError(t.calendar.assign.notFound(id));
      }
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

        <FieldLabel htmlFor="session-date">{t.calendar.assign.date}</FieldLabel>
        <Input
          id="session-date"
          type="date"
          className="w-full tabular-nums"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
        />

        <fieldset className="mt-5">
          <legend className="mb-1.5 text-footnote text-ink-2">{t.calendar.assign.training}</legend>
          <div className="relative mb-2">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input
              type="search"
              aria-label={t.calendar.assign.searchLabel}
              placeholder={t.calendar.assign.searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (shown.length === 0) void lookUpBusinessId();
              }}
              className="w-full pl-10"
            />
          </div>
          <ul className="overflow-hidden rounded-lg bg-surface-2">
            {optionsLoaded && options.length === 0 && (
              <li className="flex min-h-[52px] items-center px-4 text-callout text-ink-2">{t.calendar.assign.noneAvailable}</li>
            )}
            {options.length > 0 && shown.length === 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => void lookUpBusinessId()}
                  className="flex min-h-[52px] w-full cursor-pointer items-center px-4 text-left text-callout text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                >
                  {t.calendar.assign.lookUp(query.trim())}
                </button>
              </li>
            )}
            {shown.map((training) => {
              const isSelected = selected?.id === training.id;
              return (
                <li
                  key={training.id}
                  className={`relative before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden ${
                    isSelected ? 'bg-surface-3' : ''
                  }`}
                >
                  {/* A selectable row: the radio stays for keyboard and screen readers, the check mark shows the choice. */}
                  <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-focus">
                    <input
                      type="radio"
                      name="training"
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => setSelected(training)}
                    />
                    <span className="flex min-w-0 flex-1 flex-col py-2">
                      <span className="truncate text-headline text-ink">{training.name}</span>
                      <span className="text-footnote tabular-nums text-ink-2">{training.businessId}</span>
                    </span>
                    <Check size={20} aria-hidden="true" className={`shrink-0 text-ink ${isSelected ? '' : 'invisible'}`} />
                  </label>
                </li>
              );
            })}
          </ul>
          {optionsHasMore && !q && (
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
            <p className="mb-1.5 text-footnote text-ink-2">{t.calendar.assign.exercisesIn(selected.name)}</p>
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
                        className="relative shrink-0 text-ink-3 before:absolute before:-inset-3 hover:text-ink disabled:opacity-30"
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

        <FieldLabel htmlFor="session-notes" className="mt-5">
          {t.calendar.assign.notes}
        </FieldLabel>
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
