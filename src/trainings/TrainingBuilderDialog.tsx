import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { getExercisesByIds, listExercises } from '../exercises/exercisesApi';
import type { Exercise } from '../types/exercise';
import type { Training, TrainingExercise } from '../types/training';
import { createTraining, updateTraining } from './trainingsApi';

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

  async function openPicker() {
    setPickerOpen(true);
    try {
      const page = await listExercises();
      setPicker(page.exercises);
      setPickerLastDoc(page.lastDoc);
      setPickerHasMore(page.exercises.length > 0 && page.lastDoc !== null);
    } catch {
      setError('Could not load exercises to pick from. Please try again.');
    }
  }

  async function loadMorePicker() {
    if (!pickerLastDoc) return;
    try {
      const page = await listExercises(pickerLastDoc);
      setPicker((current) => [...current, ...page.exercises]);
      setPickerLastDoc(page.lastDoc);
      setPickerHasMore(page.exercises.length > 0 && page.lastDoc !== null);
    } catch {
      setError('Could not load more exercises. Please try again.');
    }
  }

  function addExercise(exercise: Exercise) {
    setRows((current) => [
      ...current,
      { exerciseId: exercise.id, order: current.length + 1, durationMinutes: 10, name: exercise.name },
    ]);
    setPickerOpen(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label={training ? 'Edit training' : 'New training'}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">
          {training ? `Edit ${training.businessId}` : 'New training'}
        </h2>

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

          <ul className="divide-y divide-border rounded-md border border-border">
            {rows.length === 0 && <li className="p-3 text-sm text-slate">No exercises added yet.</li>}
            {rows.map((row, i) => (
              <li key={`${row.exerciseId}-${i}`} className="flex items-center gap-2 p-3">
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
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">Pick an exercise</p>
              <ul className="divide-y divide-border">
                {picker.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => addExercise(ex)}
                      className="w-full py-2 text-left text-sm text-blue hover:underline"
                    >
                      {ex.name}
                    </button>
                  </li>
                ))}
              </ul>
              {pickerHasMore && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void loadMorePicker()}
                  className="mt-2"
                >
                  Load more
                </Button>
              )}
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => void openPicker()} className="mt-2">
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
    </div>
  );
}
