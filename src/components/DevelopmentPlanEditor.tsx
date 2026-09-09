import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { EditButton } from './EditButton';
import { Input, Textarea } from './Input';
import { StatusChip, STATUS_OPTIONS } from './StatusChip';
import type {
  DevelopmentPlan,
  ObjectiveStatus,
  SeasonObjective,
  ShortTermObjective,
} from '../types/developmentPlan';

interface DevelopmentPlanEditorProps {
  plan: DevelopmentPlan;
  onSave: (plan: DevelopmentPlan) => Promise<void>;
  isAdmin: boolean;
  /**
   * Controlled edit state. Omit both to let the component manage its own edit
   * state and render its own "Edit" button (used on the team plan tab).
   */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

const selectClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue';

const STATUS_ACCENT: Record<ObjectiveStatus, string> = {
  Active: 'border-l-green',
  'In progress': 'border-l-blue',
  Completed: 'border-l-ink',
  'Not started': 'border-l-slate',
  Attention: 'border-l-orange',
};

function ObjectiveCard({
  title,
  status,
  targetLabel,
  coachComment,
}: {
  title: string;
  status: ObjectiveStatus;
  targetLabel: string;
  coachComment: string;
}) {
  return (
    <div className={`rounded-md border border-l-[3px] border-border bg-bg/40 p-3 ${STATUS_ACCENT[status]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink">{title || 'Untitled objective'}</p>
        <StatusChip status={status} />
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-xs text-slate">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        {targetLabel}
      </p>
      {coachComment && (
        <p className="mt-2 border-t border-border pt-2 text-xs text-slate">{coachComment}</p>
      )}
    </div>
  );
}

function GroupHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h3 className="text-sm font-semibold text-ink">{label}</h3>
      <span className="text-xs tabular-nums text-slate">{count}</span>
    </div>
  );
}

export function DevelopmentPlanEditor({
  plan,
  onSave,
  isAdmin,
  editing: editingProp,
  onEditingChange,
}: DevelopmentPlanEditorProps) {
  const isControlled = editingProp !== undefined;
  const [internalEditing, setInternalEditing] = useState(false);
  const editing = isControlled ? editingProp : internalEditing;
  const setEditing = (value: boolean) => {
    if (!isControlled) setInternalEditing(value);
    onEditingChange?.(value);
  };

  const [shortTermObjectives, setShortTermObjectives] = useState<ShortTermObjective[]>(plan.shortTermObjectives);
  const [seasonObjectives, setSeasonObjectives] = useState<SeasonObjective[]>(plan.seasonObjectives);
  const [generalNotes, setGeneralNotes] = useState(plan.generalNotes);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setShortTermObjectives(plan.shortTermObjectives);
      setSeasonObjectives(plan.seasonObjectives);
      setGeneralNotes(plan.generalNotes);
      setError(null);
    }
  }, [editing, plan]);

  function updateShortTerm(index: number, updates: Partial<ShortTermObjective>) {
    setShortTermObjectives((current) => current.map((o, i) => (i === index ? { ...o, ...updates } : o)));
  }
  function addShortTerm() {
    setShortTermObjectives((current) => [
      ...current,
      { objective: '', targetDate: '', status: 'Not started', coachComment: '' },
    ]);
  }
  function removeShortTerm(index: number) {
    setShortTermObjectives((current) => current.filter((_, i) => i !== index));
  }

  function updateSeason(index: number, updates: Partial<SeasonObjective>) {
    setSeasonObjectives((current) => current.map((o, i) => (i === index ? { ...o, ...updates } : o)));
  }
  function addSeason() {
    setSeasonObjectives((current) => [...current, { objective: '', target: '', status: 'Not started', coachComment: '' }]);
  }
  function removeSeason(index: number) {
    setSeasonObjectives((current) => current.filter((_, i) => i !== index));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await onSave({ shortTermObjectives, seasonObjectives, generalNotes });
    } catch {
      setError('Could not save the development plan. Please try again.');
      return;
    }
    setEditing(false);
  }

  function handleCancel() {
    setShortTermObjectives(plan.shortTermObjectives);
    setSeasonObjectives(plan.seasonObjectives);
    setGeneralNotes(plan.generalNotes);
    setEditing(false);
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <section>
        <GroupHeading label="Short-term objectives" count={plan.shortTermObjectives.length} />
        {plan.shortTermObjectives.length === 0 ? (
          <p className="text-sm text-slate">No short-term objectives yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {plan.shortTermObjectives.map((o, i) => (
              <ObjectiveCard
                key={i}
                title={o.objective}
                status={o.status}
                targetLabel={o.targetDate ? `Target date ${o.targetDate}` : 'No target date'}
                coachComment={o.coachComment}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <GroupHeading label="Season objectives" count={plan.seasonObjectives.length} />
        {plan.seasonObjectives.length === 0 ? (
          <p className="text-sm text-slate">No season objectives yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {plan.seasonObjectives.map((o, i) => (
              <ObjectiveCard
                key={i}
                title={o.objective}
                status={o.status}
                targetLabel={o.target ? `Target ${o.target}` : 'No target set'}
                coachComment={o.coachComment}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">General notes</h3>
        <p className="whitespace-pre-wrap text-sm text-slate">{plan.generalNotes || 'No notes yet.'}</p>
      </section>

      {!isControlled && isAdmin && (
        <EditButton onClick={() => setEditing(true)} className="self-start" />
      )}

      {editing && isAdmin && (
        <Dialog title="Edit development plan" size="lg" onClose={handleCancel}>
          <form onSubmit={handleSave} aria-label="Edit development plan">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate">Short-term objectives</h3>
            {shortTermObjectives.map((o, i) => (
              <div key={i} className="mt-3 rounded-md border border-border p-3">
                <label htmlFor={`short-term-objective-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  Objective
                </label>
                <Input
                  id={`short-term-objective-${i}`}
                  value={o.objective}
                  onChange={(e) => updateShortTerm(i, { objective: e.target.value })}
                  className="mb-3 w-full"
                />

                <label htmlFor={`short-term-date-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  Target date
                </label>
                <Input
                  id={`short-term-date-${i}`}
                  type="date"
                  value={o.targetDate}
                  onChange={(e) => updateShortTerm(i, { targetDate: e.target.value })}
                  className="mb-3 w-full"
                />

                <label htmlFor={`short-term-status-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  Status
                </label>
                <select
                  id={`short-term-status-${i}`}
                  className={`${selectClass} mb-3`}
                  value={o.status}
                  onChange={(e) => updateShortTerm(i, { status: e.target.value as ObjectiveStatus })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <label htmlFor={`short-term-comment-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  Coach comment
                </label>
                <Textarea
                  id={`short-term-comment-${i}`}
                  value={o.coachComment}
                  onChange={(e) => updateShortTerm(i, { coachComment: e.target.value })}
                  className="w-full"
                />

                <Button variant="dangerGhost" size="sm" onClick={() => removeShortTerm(i)} className="mt-2">
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addShortTerm} className="mt-3">
              + Add short-term objective
            </Button>

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate">Season objectives</h3>
            {seasonObjectives.map((o, i) => (
              <div key={i} className="mt-3 rounded-md border border-border p-3">
                <label htmlFor={`season-objective-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  Objective
                </label>
                <Input
                  id={`season-objective-${i}`}
                  value={o.objective}
                  onChange={(e) => updateSeason(i, { objective: e.target.value })}
                  className="mb-3 w-full"
                />

                <label htmlFor={`season-target-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  Target
                </label>
                <Input
                  id={`season-target-${i}`}
                  value={o.target}
                  onChange={(e) => updateSeason(i, { target: e.target.value })}
                  className="mb-3 w-full"
                />

                <label htmlFor={`season-status-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  Status
                </label>
                <select
                  id={`season-status-${i}`}
                  className={`${selectClass} mb-3`}
                  value={o.status}
                  onChange={(e) => updateSeason(i, { status: e.target.value as ObjectiveStatus })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <label htmlFor={`season-comment-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  Coach comment
                </label>
                <Textarea
                  id={`season-comment-${i}`}
                  value={o.coachComment}
                  onChange={(e) => updateSeason(i, { coachComment: e.target.value })}
                  className="w-full"
                />

                <Button variant="dangerGhost" size="sm" onClick={() => removeSeason(i)} className="mt-2">
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addSeason} className="mt-3">
              + Add season objective
            </Button>

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate">General notes</h3>
            <Textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="mt-2 min-h-[100px] w-full"
            />

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save
              </Button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red">
                {error}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </div>
  );
}
