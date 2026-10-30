import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { OfflineError, useSave } from '../components/useSave';
import { Sheet } from '../components/Sheet';
import { FieldLabel, Input, Textarea } from '../components/Input';
import { Select } from '../components/Select';
import { DiagramSvg } from '../diagrams/DiagramSvg';
import { DiagramLightbox } from '../diagrams/DiagramLightbox';
import { listDiagrams } from '../diagrams/diagramsApi';
import { parseOptionalInt } from '../components/parseOptionalInt';
import { EXERCISE_CATEGORIES, PLAYER_LIMITS, type Exercise, type ExerciseCategory } from '../types/exercise';
import type { Diagram } from '../types/diagram';
import { createExercise, updateExercise } from './exercisesApi';
import { exerciseFocusLabels, exerciseNameExample } from '../trainings/naming';
import { useT } from '../i18n/I18nProvider';
import { LIMITS } from '../types/limits';

const FORM_ID = 'exercise-form';

interface ExerciseFormDialogProps {
  exercise?: Exercise;
  onClose: () => void;
  onSaved: () => void;
}

export function ExerciseFormDialog({ exercise, onClose, onSaved }: ExerciseFormDialogProps) {
  const t = useT();
  const lb = t.labels;
  const f = t.exercises.form;
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
      setError(f.nameRequired);
      return null;
    }
    const { min, max } = PLAYER_LIMITS.minPlayers;
    const minPlayers = parseOptionalInt(minPlayersText, min, max);
    if (!minPlayers.ok) {
      setError(f.minPlayersRange(min, max));
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
      setError(f.saveError);
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
      setError(e instanceof OfflineError ? f.offline : f.createError);
    }
  }

  return (
    <Sheet
      guardUnsaved
      detent="large"
      title={exercise ? f.editTitle : f.newTitle}
      onClose={onClose}
      confirm={{ label: saving ? f.saving : t.common.save, form: FORM_ID, disabled: saving }}
    >
      <form id={FORM_ID} onSubmit={handleSubmit} aria-label={exercise ? f.editTitle : f.newTitle}>
        <FieldLabel htmlFor="exercise-name">
          {f.name}
        </FieldLabel>
        <Input
          id="exercise-name"
          maxLength={LIMITS.shortText}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={exerciseNameExample()}
          aria-describedby="exercise-name-hint"
        />
        <p id="exercise-name-hint" className="mt-1.5 text-footnote text-ink-2">
          {f.nameHint(exerciseNameExample(), exerciseFocusLabels().join(', '))}
        </p>

        <FieldLabel htmlFor="exercise-category" className="mt-4">
          {f.category}
        </FieldLabel>
        <Select
          id="exercise-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
        >
          {EXERCISE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {lb.exerciseCategory[c.key]}
            </option>
          ))}
        </Select>

        <FieldLabel htmlFor="exercise-min-players" className="mt-4">
          {f.minPlayers}
        </FieldLabel>
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
        <p id="exercise-min-players-hint" className="mt-1.5 text-footnote text-ink-2">
          {f.minPlayersHint}
        </p>

        <FieldLabel htmlFor="exercise-description" className="mt-4">
          {f.description}
        </FieldLabel>
        <Textarea
          id="exercise-description"
          maxLength={LIMITS.longText}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />

        {exercise && (
          <div className="mt-4">
            <h3 className="mb-2 text-title-3 text-ink">{f.diagrams}</h3>
            <button
              type="button"
              onClick={() => navigate(`/exercises/${exercise.id}/diagram`)}
              className="mb-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 text-left text-body text-ink active:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {f.editDiagrams}
              <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-3" />
            </button>
            {diagrams.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                {diagrams.map((d, idx) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setLightbox(idx)}
                    className="min-w-0 shrink-0 text-left"
                    aria-label={f.openDiagram(d.title)}
                  >
                    <span className="block aspect-square w-full overflow-hidden rounded-md bg-surface-2 sm:w-20">
                      <DiagramSvg scene={d.scene} fit />
                    </span>
                    <span className="mt-0.5 block truncate text-footnote text-ink-2 sm:max-w-20">{d.title}</span>
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

        {!exercise && (
          <Button variant="secondary" onClick={handleCreateAndDraw} disabled={saving} className="mt-6 w-full">
            {f.createAndAdd}
          </Button>
        )}

        {error && (
          <p role="alert" className="mt-3 text-callout text-red-strong">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}
