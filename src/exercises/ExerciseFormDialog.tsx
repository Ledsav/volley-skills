import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { DiagramSvg } from '../diagrams/DiagramSvg';
import { DiagramLightbox } from '../diagrams/DiagramLightbox';
import { listDiagrams } from '../diagrams/diagramsApi';
import { EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory } from '../types/exercise';
import type { Diagram } from '../types/diagram';
import { createExercise, updateExercise } from './exercisesApi';

interface ExerciseFormDialogProps {
  exercise?: Exercise;
  onClose: () => void;
  onSaved: () => void;
}

export function ExerciseFormDialog({ exercise, onClose, onSaved }: ExerciseFormDialogProps) {
  const { firebaseUser } = useAuth();
  const [name, setName] = useState(exercise?.name ?? '');
  const [description, setDescription] = useState(exercise?.description ?? '');
  const [category, setCategory] = useState<ExerciseCategory>(exercise?.category ?? 'warmup');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (!exercise) return;
    listDiagrams(exercise.id).then(setDiagrams).catch(() => setDiagrams([]));
  }, [exercise]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError(null);
    try {
      if (exercise) {
        await updateExercise(exercise.id, { name: name.trim(), description, category });
      } else {
        if (!firebaseUser) return;
        await createExercise({ name: name.trim(), description, category }, firebaseUser.uid);
      }
      onSaved();
    } catch {
      setError('Could not save the exercise. Please try again.');
    }
  }

  async function handleCreateAndDraw() {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!firebaseUser) return;
    setError(null);
    try {
      const id = await createExercise({ name: name.trim(), description, category }, firebaseUser.uid);
      navigate(`/exercises/${id}/diagram`);
    } catch {
      setError('Could not create the exercise. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label={exercise ? 'Edit exercise' : 'New exercise'}
        className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-pop"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">
          {exercise ? 'Edit exercise' : 'New exercise'}
        </h2>

        <label htmlFor="exercise-name" className="mb-1 block text-sm font-medium text-ink">
          Name
        </label>
        <Input id="exercise-name" value={name} onChange={(e) => setName(e.target.value)} />

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
              {c.label}
            </option>
          ))}
        </select>

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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/exercises/${exercise.id}/diagram`)}
              >
                Edit diagrams
              </Button>
            </div>
            {diagrams.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {diagrams.map((d, idx) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setLightbox(idx)}
                    className="shrink-0"
                    aria-label={`Open diagram ${d.title}`}
                  >
                    <span className="block aspect-square w-20 overflow-hidden rounded-sm border border-border bg-bg">
                      <DiagramSvg scene={d.scene} />
                    </span>
                    <span className="mt-0.5 block max-w-20 truncate text-xs text-slate">{d.title}</span>
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

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {!exercise && (
            <Button variant="secondary" onClick={handleCreateAndDraw}>
              Create &amp; add diagrams
            </Button>
          )}
          <Button variant="primary" type="submit">
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
