import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Input, Textarea } from '../components/Input';
import { DiagramThumbnail } from '../diagrams/DiagramThumbnail';
import { getExercisesByIds, listExercises } from '../exercises/exercisesApi';
import { EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory } from '../types/exercise';
import type { Training, TrainingExercise } from '../types/training';
import { createTraining, updateTraining } from './trainingsApi';

const CATEGORY_LABEL = Object.fromEntries(EXERCISE_CATEGORIES.map((c) => [c.key, c.label])) as Record<
  ExerciseCategory,
  string
>;

const chipClass = (active: boolean) =>
  `rounded-full px-2.5 py-1 text-xs font-medium ${
    active ? 'bg-blue text-white' : 'border border-border bg-surface text-slate hover:bg-bg'
  }`;

interface Row extends TrainingExercise {
  name: string | null; // null => the exercise no longer exists
}

interface TrainingBuilderDialogProps {
  training?: Training;
  onClose: () => void;
  onSaved: () => void;
}

export function TrainingBuilderDialog({ training, onClose, onSaved }: TrainingBuilderDialogProps) {
  const { firebaseUser } = useAuth();
  const [name, setName] = useState(training?.name ?? '');
  const [description, setDescription] = useState(training?.description ?? '');
  const [ageGroupTarget, setAgeGroupTarget] = useState(training?.ageGroupTarget ?? '');
  const [rows, setRows] = useState<Row[]>([]);
  const [picker, setPicker] = useState<Exercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<ExerciseCategory | ''>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pickerLastDoc, setPickerLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [pickerHasMore, setPickerHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!training) return;
    void getExercisesByIds(training.exercises.map((e) => e.exerciseId))
      .then((found) => {
        const byId = new Map(found.map((ex) => [ex.id, ex.name]));
        setRows(
          training.exercises
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((e) => ({ ...e, name: byId.get(e.exerciseId) ?? null }))
        );
      })
      .catch(() => setError('Could not load the exercises for this training. Please reopen the dialog.'));
  }, [training]);

  async function loadPicker(category: ExerciseCategory | '', afterDoc: QueryDocumentSnapshot | null) {
    try {
      const page = await listExercises(afterDoc, category || null);
      setPicker((current) => (afterDoc ? [...current, ...page.exercises] : page.exercises));
      setPickerLastDoc(page.lastDoc);
      setPickerHasMore(page.exercises.length > 0 && page.lastDoc !== null);
    } catch {
      setError(
        afterDoc
          ? 'Could not load more exercises. Please try again.'
          : 'Could not load exercises to pick from. Please try again.'
      );
    }
  }

  function openPicker() {
    setPickerOpen(true);
    void loadPicker(pickerCategory, null);
  }

  function selectCategory(category: ExerciseCategory | '') {
    setPickerCategory(category);
    setExpandedId(null);
    setPicker([]);
    setPickerLastDoc(null);
    setPickerHasMore(false);
    void loadPicker(category, null);
  }

  function addExercise(exercise: Exercise) {
    setRows((current) => [
      ...current,
      { exerciseId: exercise.id, order: current.length + 1, durationMinutes: 10, name: exercise.name },
    ]);
    // Picker stays open so several exercises can be added in one pass.
  }

  function move(index: number, delta: number) {
    setRows((current) => {
      const next = current.slice();
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function setDuration(index: number, value: number) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, durationMinutes: value } : row)));
  }

  const totalMinutes = useMemo(() => rows.reduce((sum, r) => sum + (r.durationMinutes || 0), 0), [rows]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError(null);
    const exercises: TrainingExercise[] = rows.map((row, i) => ({
      exerciseId: row.exerciseId,
      order: i + 1,
      durationMinutes: row.durationMinutes,
    }));
    try {
      if (training) {
        await updateTraining(training.id, { name: name.trim(), description, ageGroupTarget, exercises });
      } else {
        if (!firebaseUser) return;
        await createTraining({ name: name.trim(), description, ageGroupTarget, exercises }, firebaseUser.uid);
      }
      onSaved();
    } catch {
      setError('Could not save the training. Please try again.');
    }
  }

  return (
    <Dialog title={training ? `Edit ${training.businessId}` : 'New training'} size="lg" onClose={onClose}>
      <form onSubmit={handleSubmit} aria-label={training ? 'Edit training' : 'New training'}>
        <label htmlFor="training-name" className="mb-1 block text-sm font-medium text-ink">
          Name
        </label>
        <Input id="training-name" value={name} onChange={(e) => setName(e.target.value)} />

        <label htmlFor="training-age" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Age group target
        </label>
        <Input id="training-age" value={ageGroupTarget} onChange={(e) => setAgeGroupTarget(e.target.value)} />

        <label htmlFor="training-description" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Description
        </label>
        <Textarea
          id="training-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Exercises</span>
            <span className="text-sm text-slate">Total: {totalMinutes} min</span>
          </div>

          <ul aria-label="Training exercises" className="divide-y divide-border rounded-md border border-border">
            {rows.length === 0 && <li className="p-3 text-sm text-slate">No exercises added yet.</li>}
            {rows.map((row, i) => (
              <li key={`${row.exerciseId}-${i}`} className="flex items-center gap-2 p-3">
                <DiagramThumbnail
                  exerciseId={row.exerciseId}
                  className="aspect-square w-10 shrink-0 overflow-hidden rounded-sm border border-border"
                />
                <span className="w-6 text-sm tabular-nums text-slate">{i + 1}</span>
                <span className={`flex-1 text-sm ${row.name ? 'text-ink' : 'text-red'}`}>
                  {row.name ?? '⚠ Deleted exercise'}
                </span>
                <input
                  type="number"
                  min={0}
                  aria-label={`Duration for exercise ${i + 1} (min)`}
                  value={row.durationMinutes}
                  onChange={(e) => setDuration(i, Number(e.target.value))}
                  className="w-20 rounded-md border border-border px-2 py-1 text-right tabular-nums"
                />
                <button
                  type="button"
                  aria-label={`Move exercise ${i + 1} up`}
                  onClick={() => move(i, -1)}
                  className="px-1 text-slate hover:text-ink"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move exercise ${i + 1} down`}
                  onClick={() => move(i, 1)}
                  className="px-1 text-slate hover:text-ink"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Remove exercise ${i + 1}`}
                  onClick={() => removeRow(i)}
                  className="px-1 text-red hover:text-red-strong"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {pickerOpen ? (
            <div className="mt-2 rounded-md border border-border p-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate">Pick an exercise</p>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="text-xs font-medium text-slate hover:text-ink"
                >
                  Done
                </button>
              </div>

              <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter exercises by category">
                <button type="button" aria-pressed={pickerCategory === ''} onClick={() => selectCategory('')} className={chipClass(pickerCategory === '')}>
                  All
                </button>
                {EXERCISE_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={pickerCategory === c.key}
                    onClick={() => selectCategory(c.key)}
                    className={chipClass(pickerCategory === c.key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <ul className="divide-y divide-border">
                {picker.length === 0 && (
                  <li className="py-2 text-sm text-slate">No exercises in this category.</li>
                )}
                {picker.map((ex) => {
                  const expanded = expandedId === ex.id;
                  return (
                    <li key={ex.id} className="py-2">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={expanded ? `Collapse ${ex.name}` : `Expand ${ex.name}`}
                          onClick={() => setExpandedId(expanded ? null : ex.id)}
                          className="mt-0.5 shrink-0 text-slate hover:text-ink"
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2">
                            <span className="text-sm font-medium text-ink">{ex.name}</span>
                            <span className="rounded-sm bg-blue/10 px-1.5 py-0.5 text-xs font-medium text-blue">
                              {CATEGORY_LABEL[ex.category]}
                            </span>
                          </div>
                          {ex.description && !expanded && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-slate">{ex.description}</p>
                          )}
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => addExercise(ex)}
                          aria-label={`Add ${ex.name}`}
                          className="shrink-0"
                        >
                          Add
                        </Button>
                      </div>
                      {expanded && (
                        <div className="mt-2 flex gap-3 pl-6">
                          <DiagramThumbnail
                            exerciseId={ex.id}
                            className="aspect-square w-24 shrink-0 overflow-hidden rounded-sm border border-border"
                          />
                          <p className="text-xs text-slate">{ex.description || 'No description.'}</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {pickerHasMore && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void loadPicker(pickerCategory, pickerLastDoc)}
                  className="mt-2"
                >
                  Load more
                </Button>
              )}
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={openPicker} className="mt-2">
              Add exercise
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
