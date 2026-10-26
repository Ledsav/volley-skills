import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Input, Textarea } from '../components/Input';
import { DiagramThumbnail } from '../diagrams/DiagramThumbnail';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../types/exercise';
import { DraftDiagramPreview } from './DraftDiagramPreview';
import { NumberField } from './NumberField';
import { moveStep, removeStep, setStepMinutes, stepName, totalMinutes } from './trainingDraftOps';
import { DRAFT_LIMITS, type TrainingDraft } from './types';
import { PlayersNote } from '../trainings/PlayersNote';

const CATEGORY_LABEL = Object.fromEntries(EXERCISE_CATEGORIES.map((c) => [c.key, c.label])) as Record<
  ExerciseCategory,
  string
>;

const iconBtn =
  'inline-flex h-11 w-11 items-center justify-center rounded-md text-slate hover:bg-bg hover:text-ink disabled:opacity-30 sm:h-9 sm:w-9';

interface Props {
  draft: TrainingDraft;
  targetMinutes: number;
  onChange: (next: TrainingDraft) => void;
  onView: (index: number) => void;
}

/** Editable header + ordered steps of an AI training proposal. Removing a new step drops its exercise too. */
export function TrainingProposalReview({ draft, targetMinutes, onChange, onView }: Props) {
  const total = totalMinutes(draft);
  const off = Math.abs(total - targetMinutes) > targetMinutes * 0.1;
  return (
    <div className="flex flex-col gap-4">
      <p><span className="inline-block rounded-sm bg-blue/10 px-1.5 py-0.5 text-xs font-medium text-blue">AI draft</span></p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="tdraft-name" className="mb-1 block text-sm font-medium text-ink">
            Training name
          </label>
          <Input
            id="tdraft-name"
            maxLength={DRAFT_LIMITS.nameMax}
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="tdraft-age" className="mb-1 block text-sm font-medium text-ink">
            Age group target
          </label>
          <Input id="tdraft-age" value={draft.ageGroupTarget} onChange={(e) => onChange({ ...draft, ageGroupTarget: e.target.value })} />
        </div>
      </div>
      <div>
        <label htmlFor="tdraft-desc" className="mb-1 block text-sm font-medium text-ink">
          Description
        </label>
        <Textarea
          id="tdraft-desc"
          rows={3}
          maxLength={DRAFT_LIMITS.descriptionMax}
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
        />
      </div>

      <p className={`text-sm tabular-nums ${off ? 'text-orange' : 'text-slate'}`}>
        {total} / {targetMinutes} min
      </p>
      {draft.issues.length > 0 && (
        <ul className="text-xs text-slate">
          {draft.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}

      <ol aria-label="Steps" className="flex flex-col divide-y divide-border">
        {draft.steps.map((s, i) => {
          const name = stepName(s);
          const category = s.kind === 'library' ? s.category : s.exercise.category;
          return (
            <li key={s.kind === 'library' ? `${s.exerciseId}-${i}` : s.exercise.key} className="flex items-center gap-3 py-3">
              {s.kind === 'library' ? (
                <DiagramThumbnail exerciseId={s.exerciseId} interactive={false} className="h-16 w-16 shrink-0" />
              ) : (
                <DraftDiagramPreview scene={s.exercise.scene} label={`Diagram for ${name}`} className="h-16 w-16" />
              )}
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  aria-label={`View ${name}`}
                  onClick={() => onView(i)}
                  className="block max-w-full truncate text-left font-medium text-ink hover:underline"
                >
                  {name}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${
                      s.kind === 'new' ? 'bg-orange/10 text-orange' : 'bg-bg text-slate'
                    }`}
                  >
                    {s.kind === 'new' ? 'New' : 'Library'}
                  </span>
                  {category && (
                    <span className="rounded-sm bg-blue/10 px-1.5 py-0.5 text-xs font-medium text-blue">{CATEGORY_LABEL[category]}</span>
                  )}
                  <PlayersNote
                    minPlayers={s.kind === 'library' ? s.minPlayers : s.exercise.minPlayers}
                    suggested={draft.suggestedPlayers}
                  />
                </div>
              </div>
              <NumberField
                aria-label={`Minutes for ${name}`}
                min={DRAFT_LIMITS.minutesMin}
                max={DRAFT_LIMITS.minutesMax}
                className="w-16 tabular-nums"
                value={s.minutes}
                onChange={(m) => onChange(setStepMinutes(draft, i, m))}
              />
              <div className="flex shrink-0">
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Move ${name} up`}
                  disabled={i === 0}
                  onClick={() => onChange(moveStep(draft, i, -1))}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Move ${name} down`}
                  disabled={i === draft.steps.length - 1}
                  onClick={() => onChange(moveStep(draft, i, 1))}
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button type="button" className={iconBtn} aria-label={`Remove ${name}`} onClick={() => onChange(removeStep(draft, i))}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
