import { useState, type FormEvent } from 'react';
import { Button } from './Button';
import { Input, Textarea } from './Input';
import { StatusChip, STATUS_OPTIONS } from './StatusChip';
import type { DevelopmentPlan, ObjectiveStatus, SeasonObjective, ShortTermObjective } from '../types/developmentPlan';

interface DevelopmentPlanEditorProps {
  plan: DevelopmentPlan;
  onSave: (plan: DevelopmentPlan) => Promise<void>;
  isAdmin: boolean;
}

const selectClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue';

export function DevelopmentPlanEditor({ plan, onSave, isAdmin }: DevelopmentPlanEditorProps) {
  const [editing, setEditing] = useState(false);
  const [shortTermObjectives, setShortTermObjectives] = useState<ShortTermObjective[]>(plan.shortTermObjectives);
  const [seasonObjectives, setSeasonObjectives] = useState<SeasonObjective[]>(plan.seasonObjectives);
  const [generalNotes, setGeneralNotes] = useState(plan.generalNotes);
  const [error, setError] = useState<string | null>(null);

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

  if (!editing || !isAdmin) {
    return (
      <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Development Plan</h2>

        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate">Short-term objectives</h3>
        {plan.shortTermObjectives.length === 0 && <p className="mt-2 text-slate">None yet.</p>}
        {plan.shortTermObjectives.map((o, i) => (
          <p key={i} className="mt-2 text-slate">
            {o.objective} — {o.targetDate} — <StatusChip status={o.status} /> — {o.coachComment}
          </p>
        ))}

        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate">Season objectives</h3>
        {plan.seasonObjectives.length === 0 && <p className="mt-2 text-slate">None yet.</p>}
        {plan.seasonObjectives.map((o, i) => (
          <p key={i} className="mt-2 text-slate">
            {o.objective} — {o.target} — <StatusChip status={o.status} /> — {o.coachComment}
          </p>
        ))}

        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate">General notes</h3>
        <p className="mt-2 whitespace-pre-wrap text-slate">{plan.generalNotes || 'None yet.'}</p>

        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="mt-4">
            Edit
          </Button>
        )}
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      aria-label="Edit development plan"
      className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card"
    >
      <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">Development Plan</h2>

      <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate">Short-term objectives</h3>
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

          <Button variant="ghost" size="sm" onClick={() => removeShortTerm(i)} className="mt-2">
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

          <Button variant="ghost" size="sm" onClick={() => removeSeason(i)} className="mt-2">
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

      <div className="mt-6 flex gap-3">
        <Button variant="primary" type="submit">
          Save
        </Button>
        <Button variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}
    </form>
  );
}
