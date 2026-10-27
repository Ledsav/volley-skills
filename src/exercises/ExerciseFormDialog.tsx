import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { OfflineError, useSave } from '../components/useSave';
import { Dialog } from '../components/Dialog';
import { EditButton } from '../components/EditButton';
import { Input, Textarea } from '../components/Input';
import { DiagramSvg } from '../diagrams/DiagramSvg';
import { DiagramLightbox } from '../diagrams/DiagramLightbox';
import { listDiagrams } from '../diagrams/diagramsApi';
import { parseOptionalInt } from '../components/parseOptionalInt';
import { EXERCISE_CATEGORIES, PLAYER_LIMITS, type Exercise, type ExerciseCategory } from '../types/exercise';
import type { Diagram } from '../types/diagram';
import { createExercise, updateExercise } from './exercisesApi';
import { EXERCISE_NAME_EXAMPLE, EXERCISE_NAME_HINT } from '../trainings/naming';
import { useT } from '../i18n/I18nProvider';

const FORM_ID = 'exercise-form';

interface ExerciseFormDialogProps {
  exercise?: Exercise;
  onClose: () => void;
  onSaved: () => void;
}

export function ExerciseFormDialog({ exercise, onClose, onSaved }: ExerciseFormDialogProps) {
  const lb = useT().labels;
  const { firebaseUser } = useAuth();
  const [name, setName] = useState(exercise?.name ?? '');
  const [description, setDescription] = useState(exercise?.description ?? '');
  const [category, setCategory] = useState<ExerciseCategory>(exercise?.category ?? 'warmup');
  const [minPlayersText, setMinPlayersText] = useState(exercise?.minPlayers?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (!exercise) return;
    listDiagrams(exercise.id).then(setDiagrams).catch(() => setDiagrams([]));
  }, [exercise]);

  const { saving, save } = useSave();

  /** The form's fields, or null (with the error shown) when they don't validate. */
  // No min/max on the input: native validation would block submit silently, the inline alert explains instead.
  function readFields(): { name: string; description: string; category: ExerciseCategory; minPlayers?: number | null } | null {
    if (!name.trim()) {
      setError('Name is required.');
      return null;
    }
    const { min, max } = PLAYER_LIMITS.minPlayers;
    const minPlayers = parseOptionalInt(minPlayersText, min, max);
    if (!minPlayers.ok) {
      setError(`Minimum players must be a whole number from ${min} to ${max}.`);
      return null;
    }
    const fields = { name: name.trim(), description, category };
    if (minPlayers.value !== null) return { ...fields, minPlayers: minPlayers.value };
    // Blank clears it, but only an exercise that had one needs the delete.
    return exercise?.minPlayers !== undefined ? { ...fields, minPlayers: null } : fields;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fields = readFields();
    if (!fields) return;
    const uid = firebaseUser?.uid;
    if (!exercise && !uid) return;
    setError(null);
    try {
      const done = await save(() =>
        exercise
          ? updateExercise(exercise.id, fields)
          : createExercise({ ...fields, minPlayers: fields.minPlayers ?? undefined }, uid ?? ''),
      );
      if (!done) return;
      onSaved();
    } catch {
      setError('Could not save the exercise. Please try again.');
    }
  }

  async function handleCreateAndDraw() {
    const fields = readFields();
    if (!fields) return;
    if (!firebaseUser) return;
    setError(null);
    const uid = firebaseUser.uid;
    try {
      let id = '';
      const done = await save(
        async () => {
          id = await createExercise({ ...fields, minPlayers: fields.minPlayers ?? undefined }, uid);
        },
        { offline: 'block' },
      );
      if (!done) return;
      navigate(`/exercises/${id}/diagram`);
    } catch (e) {
      setError(e instanceof OfflineError ? "You're offline. Creating an exercise and opening its diagram editor needs a connection; use Save instead, or try again when online." : 'Could not create the exercise. Please try again.');
    }
  }

  return (
    <Dialog
      guardUnsaved
      title={exercise ? 'Edit exercise' : 'New exercise'}
      onClose={onClose}
      mobileSheet
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="hidden sm:inline-flex">
            Cancel
          </Button>
          {!exercise && (
            <Button variant="secondary" onClick={handleCreateAndDraw} disabled={saving} className="flex-1 sm:flex-none">
              Create &amp; add diagrams
            </Button>
          )}
          <Button variant="primary" type="submit" form={FORM_ID} disabled={saving} className="flex-1 sm:flex-none">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} aria-label={exercise ? 'Edit exercise' : 'New exercise'}>
        <label htmlFor="exercise-name" className="mb-1 block text-sm font-medium text-ink">
          Name
        </label>
        <Input
          id="exercise-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={EXERCISE_NAME_EXAMPLE}
          aria-describedby="exercise-name-hint"
        />
        <p id="exercise-name-hint" className="mt-1 text-xs text-slate">
          {EXERCISE_NAME_HINT}
        </p>

        <label htmlFor="exercise-category" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Category
        </label>
        <select
          id="exercise-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-blue"
        >
          {EXERCISE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {lb.exerciseCategory[c.key]}
            </option>
          ))}
        </select>

        <label htmlFor="exercise-min-players" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Minimum players
        </label>
        <Input
          id="exercise-min-players"
          // Text, not type="number": a number input reports "" for input it can't parse
          // (e.g. "7,5"), which would read as "not set" instead of showing the error.
          type="text"
          inputMode="numeric"
          value={minPlayersText}
          onChange={(e) => setMinPlayersText(e.target.value)}
          aria-describedby="exercise-min-players-hint"
          className="w-24"
        />
        <p id="exercise-min-players-hint" className="mt-1 text-xs text-slate">
          Fewest people needed to run it. Optional.
        </p>

        <label htmlFor="exercise-description" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Description
        </label>
        <Textarea
          id="exercise-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />

        {exercise && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Diagrams</span>
              <EditButton
                label="Edit diagrams"
                onClick={() => navigate(`/exercises/${exercise.id}/diagram`)}
              />
            </div>
            {diagrams.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                {diagrams.map((d, idx) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setLightbox(idx)}
                    className="min-w-0 shrink-0 text-left"
                    aria-label={`Open diagram ${d.title}`}
                  >
                    <span className="block aspect-square w-full overflow-hidden rounded-sm border border-border bg-bg sm:w-20">
                      <DiagramSvg scene={d.scene} />
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate sm:max-w-20">{d.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {lightbox !== null && (
          <DiagramLightbox
            diagrams={diagrams}
            startIndex={lightbox}
            onClose={() => setLightbox(null)}
          />
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red">
            {error}
          </p>
        )}

      </form>
    </Dialog>
  );
}
