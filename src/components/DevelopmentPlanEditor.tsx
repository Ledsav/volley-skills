import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from './Button';
import { EditButton } from './EditButton';
import { HealthHint } from './HealthHint';
import { Input, Textarea } from './Input';
import { Sheet } from './Sheet';
import { StatusChip, STATUS_OPTIONS } from './StatusChip';
import type {
  DevelopmentPlan,
  ObjectiveStatus,
  SeasonObjective,
  ShortTermObjective,
} from '../types/developmentPlan';
import { useT } from '../i18n/I18nProvider';
import { LIMITS } from '../types/limits';

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
  'w-full min-h-11 rounded-md border border-separator bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-focus';

const STATUS_ACCENT: Record<ObjectiveStatus, string> = {
  Active: 'border-l-green',
  'In progress': 'border-l-blue',
  Completed: 'border-l-ink',
  'Not started': 'border-l-ink-3',
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
  const t = useT().components.plan;
  return (
    <div className={`rounded-lg border-l-[3px] bg-surface-2 p-3 ${STATUS_ACCENT[status]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink">{title || t.untitled}</p>
        <StatusChip status={status} />
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-footnote text-ink-2">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        {targetLabel}
      </p>
      {coachComment && (
        <p className="mt-2 border-t border-separator pt-2 text-footnote text-ink-2">{coachComment}</p>
      )}
    </div>
  );
}

function GroupHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h3 className="text-title-3 text-ink">{label}</h3>
      <span className="text-footnote tabular-nums text-ink-2">{count}</span>
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
  const lb = useT().labels;
  const c = useT().common;
  const t = useT().components.plan;
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
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

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
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave({ shortTermObjectives, seasonObjectives, generalNotes });
    } catch {
      setError(t.saveError);
      return;
    } finally {
      savingRef.current = false;
      setSaving(false);
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
        <GroupHeading label={t.shortTerm} count={plan.shortTermObjectives.length} />
        {plan.shortTermObjectives.length === 0 ? (
          <p className="text-callout text-ink-2">{t.noShortTerm}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {plan.shortTermObjectives.map((o, i) => (
              <ObjectiveCard
                key={i}
                title={o.objective}
                status={o.status}
                targetLabel={o.targetDate ? t.targetDate(o.targetDate) : t.noTargetDate}
                coachComment={o.coachComment}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <GroupHeading label={t.season} count={plan.seasonObjectives.length} />
        {plan.seasonObjectives.length === 0 ? (
          <p className="text-callout text-ink-2">{t.noSeason}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {plan.seasonObjectives.map((o, i) => (
              <ObjectiveCard
                key={i}
                title={o.objective}
                status={o.status}
                targetLabel={o.target ? t.target(o.target) : t.noTarget}
                coachComment={o.coachComment}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-title-3 text-ink">{t.generalNotes}</h3>
        <p className="whitespace-pre-wrap text-callout text-ink-2">{plan.generalNotes || t.noNotes}</p>
      </section>

      {!isControlled && isAdmin && (
        <EditButton onClick={() => setEditing(true)} className="self-start" />
      )}

      {editing && isAdmin && (
        <Sheet
          title={t.editTitle}
          size="lg"
          detent="large"
          onClose={handleCancel}
          guardUnsaved
          confirm={{ label: c.save, form: 'development-plan-form', disabled: saving }}
        >
          <form id="development-plan-form" onSubmit={handleSave} aria-label={t.editTitle}>
            <h3 className="text-headline text-ink">{t.shortTerm}</h3>
            {shortTermObjectives.map((o, i) => (
              <div key={i} className="mt-3 rounded-lg border border-separator p-3">
                <label htmlFor={`short-term-objective-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  {t.objective}
                </label>
                <Input
                  id={`short-term-objective-${i}`}
                  maxLength={LIMITS.longText}
                  value={o.objective}
                  onChange={(e) => updateShortTerm(i, { objective: e.target.value })}
                  className="mb-3 w-full"
                />

                <label htmlFor={`short-term-date-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  {t.targetDateLabel}
                </label>
                <Input
                  id={`short-term-date-${i}`}
                  type="date"
                  maxLength={LIMITS.shortText}
                  value={o.targetDate}
                  onChange={(e) => updateShortTerm(i, { targetDate: e.target.value })}
                  className="mb-3 w-full"
                />

                <label htmlFor={`short-term-status-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  {t.status}
                </label>
                <select
                  id={`short-term-status-${i}`}
                  className={`${selectClass} mb-3`}
                  value={o.status}
                  onChange={(e) => updateShortTerm(i, { status: e.target.value as ObjectiveStatus })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {lb.objectiveStatus[s]}
                    </option>
                  ))}
                </select>

                <label htmlFor={`short-term-comment-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  {t.coachComment}
                </label>
                <Textarea
                  id={`short-term-comment-${i}`}
                  aria-describedby={`short-term-comment-${i}-hint`}
                  maxLength={LIMITS.longText}
                  value={o.coachComment}
                  onChange={(e) => updateShortTerm(i, { coachComment: e.target.value })}
                  className="w-full"
                />
                <HealthHint id={`short-term-comment-${i}-hint`} />

                <Button variant="dangerGhost" size="sm" onClick={() => removeShortTerm(i)} className="mt-2">
                  {t.remove}
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addShortTerm} disabled={shortTermObjectives.length >= LIMITS.objectives} className="mt-3">
              {t.addShortTerm}
            </Button>

            <h3 className="mt-6 text-headline text-ink">{t.season}</h3>
            {seasonObjectives.map((o, i) => (
              <div key={i} className="mt-3 rounded-lg border border-separator p-3">
                <label htmlFor={`season-objective-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  {t.objective}
                </label>
                <Input
                  id={`season-objective-${i}`}
                  maxLength={LIMITS.longText}
                  value={o.objective}
                  onChange={(e) => updateSeason(i, { objective: e.target.value })}
                  className="mb-3 w-full"
                />

                <label htmlFor={`season-target-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  {t.targetLabel}
                </label>
                <Input
                  id={`season-target-${i}`}
                  maxLength={LIMITS.shortText}
                  value={o.target}
                  onChange={(e) => updateSeason(i, { target: e.target.value })}
                  className="mb-3 w-full"
                />

                <label htmlFor={`season-status-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  {t.status}
                </label>
                <select
                  id={`season-status-${i}`}
                  className={`${selectClass} mb-3`}
                  value={o.status}
                  onChange={(e) => updateSeason(i, { status: e.target.value as ObjectiveStatus })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {lb.objectiveStatus[s]}
                    </option>
                  ))}
                </select>

                <label htmlFor={`season-comment-${i}`} className="mb-1 block text-sm font-medium text-ink">
                  {t.coachComment}
                </label>
                <Textarea
                  id={`season-comment-${i}`}
                  aria-describedby={`season-comment-${i}-hint`}
                  maxLength={LIMITS.longText}
                  value={o.coachComment}
                  onChange={(e) => updateSeason(i, { coachComment: e.target.value })}
                  className="w-full"
                />
                <HealthHint id={`season-comment-${i}-hint`} />

                <Button variant="dangerGhost" size="sm" onClick={() => removeSeason(i)} className="mt-2">
                  {t.remove}
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addSeason} disabled={seasonObjectives.length >= LIMITS.objectives} className="mt-3">
              {t.addSeason}
            </Button>

            <h3 className="mt-6 text-headline text-ink">{t.generalNotes}</h3>
            <Textarea
              aria-describedby="general-notes-hint"
              maxLength={LIMITS.longText}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="mt-2 min-h-[100px] w-full"
            />
            <HealthHint id="general-notes-hint" />

            {error && (
              <p role="alert" className="mt-3 text-sm text-red-strong">
                {error}
              </p>
            )}
          </form>
        </Sheet>
      )}
    </div>
  );
}
