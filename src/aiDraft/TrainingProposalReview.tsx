import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Input, Textarea } from '../components/Input';
import { DiagramThumbnail } from '../diagrams/DiagramThumbnail';
import { DraftDiagramPreview } from './DraftDiagramPreview';
import { NumberField } from './NumberField';
import { moveStep, removeStep, setStepMinutes, stepName, totalMinutes } from './trainingDraftOps';
import { DRAFT_LIMITS, type TrainingDraft } from './types';
import { PlayersNote } from '../trainings/PlayersNote';
import { useT } from '../i18n/I18nProvider';
import { draftIssueKey, draftIssueText } from './draftMessages';

const iconBtn =
  'inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-30';

interface Props {
  draft: TrainingDraft;
  targetMinutes: number;
  onChange: (next: TrainingDraft) => void;
  onView: (index: number) => void;
}

/** Editable header + ordered steps of an AI training proposal. Removing a new step drops its exercise too. */
export function TrainingProposalReview({ draft, targetMinutes, onChange, onView }: Props) {
  const catalog = useT();
  const lb = catalog.labels;
  const t = catalog.aiDraft;
  const r = t.trainingReview;
  const total = totalMinutes(draft);
  const off = Math.abs(total - targetMinutes) > targetMinutes * 0.1;
  return (
    <div className="flex flex-col gap-4">
      <p><span className="inline-block rounded-full bg-surface-3 px-2.5 text-caption text-ink-2">{t.badge}</span></p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="tdraft-name" className="mb-1 block text-callout font-medium text-ink">
            {r.trainingName}
          </label>
          <Input
            id="tdraft-name"
            maxLength={DRAFT_LIMITS.nameMax}
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="tdraft-age" className="mb-1 block text-callout font-medium text-ink">
            {r.ageGroupTarget}
          </label>
          <Input id="tdraft-age" value={draft.ageGroupTarget} onChange={(e) => onChange({ ...draft, ageGroupTarget: e.target.value })} />
        </div>
      </div>
      <div>
        <label htmlFor="tdraft-desc" className="mb-1 block text-callout font-medium text-ink">
          {r.description}
        </label>
        <Textarea
          id="tdraft-desc"
          rows={3}
          maxLength={DRAFT_LIMITS.descriptionMax}
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
        />
      </div>

      <p className={`text-callout tabular-nums ${off ? 'text-orange-strong' : 'text-ink-2'}`}>
        {r.minutesOfTarget(total, targetMinutes)}
      </p>
      {draft.issues.length > 0 && (
        <ul className="text-footnote text-ink-2">
          {draft.issues.map((issue) => (
            <li key={draftIssueKey(issue)}>{draftIssueText(issue, t)}</li>
          ))}
        </ul>
      )}

      <ol aria-label={r.steps} className="flex flex-col rounded-lg bg-surface-2">
        {draft.steps.map((s, i) => {
          const name = stepName(s);
          const category = s.kind === 'library' ? s.category : s.exercise.category;
          return (
            <li key={s.kind === 'library' ? `${s.exerciseId}-${i}` : s.exercise.key} className="relative flex items-center gap-3 px-3 py-2 before:absolute before:left-3 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden"
            >
              {s.kind === 'library' ? (
                <DiagramThumbnail exerciseId={s.exerciseId} interactive={false} className="h-16 w-16 shrink-0" />
              ) : (
                <DraftDiagramPreview scene={s.exercise.scene} label={r.diagramFor(name)} className="h-16 w-16" />
              )}
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  aria-label={r.view(name)}
                  onClick={() => onView(i)}
                  className="block min-h-11 max-w-full truncate text-left text-headline text-ink hover:underline"
                >
                  {name}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 text-caption ${
                      s.kind === 'new' ? 'bg-ink font-medium text-on-ink' : 'bg-surface-3 text-ink-2'
                    }`}
                  >
                    {s.kind === 'new' ? r.isNew : r.isLibrary}
                  </span>
                  {category && (
                    <span className="rounded-full bg-surface-3 px-2.5 text-caption text-ink-2">{lb.exerciseCategory[category]}</span>
                  )}
                  <PlayersNote
                    minPlayers={s.kind === 'library' ? s.minPlayers : s.exercise.minPlayers}
                    suggested={draft.suggestedPlayers}
                  />
                </div>
              </div>
              <NumberField
                aria-label={r.minutesFor(name)}
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
                  aria-label={r.moveUp(name)}
                  disabled={i === 0}
                  onClick={() => onChange(moveStep(draft, i, -1))}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={r.moveDown(name)}
                  disabled={i === draft.steps.length - 1}
                  onClick={() => onChange(moveStep(draft, i, 1))}
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button type="button" className={iconBtn} aria-label={r.remove(name)} onClick={() => onChange(removeStep(draft, i))}>
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
