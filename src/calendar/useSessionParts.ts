import { useEffect, useState } from 'react';
import { getExercisesByIds } from '../exercises/exercisesApi';
import { getTraining } from '../trainings/trainingsApi';

export interface SessionPart {
  exerciseId: string;
  /** Null when the exercise was deleted after the training was built. */
  name: string | null;
  durationMinutes: number;
}

export type SessionParts =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'deleted' }
  | { status: 'ready'; parts: SessionPart[]; totalMinutes: number };

/**
 * A calendar session's training parts: one `getTraining` plus one read per distinct exercise, when the sheet opens
 * (and again only if the session's training changes). A late answer after close or a change is dropped.
 */
export function useSessionParts(trainingId: string): SessionParts {
  const [state, setState] = useState<{ trainingId: string; result: Exclude<SessionParts, { status: 'loading' }> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const training = await getTraining(trainingId);
      if (!training) return { status: 'deleted' } as const;
      const rows = [...training.exercises].sort((a, b) => a.order - b.order);
      const exercises = await getExercisesByIds([...new Set(rows.map((r) => r.exerciseId))]);
      const names = new Map(exercises.map((e) => [e.id, e.name]));
      const parts = rows.map((r) => ({
        exerciseId: r.exerciseId,
        name: names.get(r.exerciseId) ?? null,
        durationMinutes: r.durationMinutes,
      }));
      return { status: 'ready', parts, totalMinutes: parts.reduce((sum, p) => sum + p.durationMinutes, 0) } as const;
    })()
      .catch(() => ({ status: 'error' }) as const)
      .then((result) => {
        if (!cancelled) setState({ trainingId, result });
      });
    return () => {
      cancelled = true;
    };
  }, [trainingId]);

  return state && state.trainingId === trainingId ? state.result : { status: 'loading' };
}
