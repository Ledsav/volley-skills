import { useState } from 'react';
import { Button } from '../components/Button';
import { FIELD_CLASS, Input, Textarea } from '../components/Input';
import { DiagramLightbox } from '../diagrams/DiagramLightbox';
import { sceneAsDiagram } from '../diagrams/sceneFactory';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../types/exercise';
import { DraftDiagramPreview } from './DraftDiagramPreview';
import { DRAFT_LIMITS, type ExerciseDraft } from './types';
import { PlayersNote } from '../trainings/PlayersNote';
import { useT } from '../i18n/I18nProvider';
import { draftIssueKey, draftIssueText } from './draftMessages';

export type ExerciseDraftPatch = Partial<Pick<ExerciseDraft, 'name' | 'category' | 'description'>>;

interface Props {
  drafts: ExerciseDraft[];
  kept: Set<string>;
  /** Drafts already written by an earlier (partly failed) save: locked, since edits could no longer reach them. */
  added: Set<string>;
  onToggleKeep: (key: string) => void;
  onEdit: (key: string, patch: ExerciseDraftPatch) => void;
}

/** One card per AI proposal: diagram preview (tap to zoom), text, issues, Keep and inline Edit. */
export function ExerciseProposalReview({ drafts, kept, added, onToggleKeep, onEdit }: Props) {
  const catalog = useT();
  const lb = catalog.labels;
  const t = catalog.aiDraft;
  const r = t.exerciseReview;
  const [editing, setEditing] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<ExerciseDraft | null>(null);

  return (
    <>
      <ul className="flex flex-col divide-y divide-border">
        {drafts.map((d) => (
          <li key={d.key} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row">
            <DraftDiagramPreview scene={d.scene} label={r.diagramFor(d.name)} onOpen={() => setZoomed(d)} />
            <div className="min-w-0 flex-1">
              <p className="mb-1"><span className="inline-block rounded-sm bg-blue/10 px-1.5 py-0.5 text-xs font-medium text-blue-strong">{t.badge}</span></p>
              {editing === d.key ? (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-ink" htmlFor={`draft-name-${d.key}`}>
                    {r.name}
                  </label>
                  <Input
                    id={`draft-name-${d.key}`}
                    maxLength={DRAFT_LIMITS.nameMax}
                    value={d.name}
                    onChange={(e) => onEdit(d.key, { name: e.target.value })}
                  />
                  <label className="text-sm font-medium text-ink" htmlFor={`draft-cat-${d.key}`}>
                    {r.category}
                  </label>
                  <select
                    id={`draft-cat-${d.key}`}
                    className={`${FIELD_CLASS} min-h-11`}
                    value={d.category ?? ''}
                    onChange={(e) => onEdit(d.key, { category: (e.target.value || null) as ExerciseCategory | null })}
                  >
                    <option value="">{r.pickCategory}</option>
                    {EXERCISE_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {lb.exerciseCategory[c.key]}
                      </option>
                    ))}
                  </select>
                  <label className="text-sm font-medium text-ink" htmlFor={`draft-desc-${d.key}`}>
                    {r.description}
                  </label>
                  <Textarea
                    id={`draft-desc-${d.key}`}
                    rows={6}
                    maxLength={DRAFT_LIMITS.descriptionMax}
                    value={d.description}
                    onChange={(e) => onEdit(d.key, { description: e.target.value })}
                  />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{d.name}</span>
                    {d.category && (
                      <span className="rounded-sm bg-blue/10 px-1.5 py-0.5 text-xs font-medium text-blue-strong">
                        {lb.exerciseCategory[d.category]}
                      </span>
                    )}
                    <PlayersNote minPlayers={d.minPlayers} suggested={null} />
                    {added.has(d.key) && (
                      <span className="rounded-sm bg-green/10 px-1.5 py-0.5 text-xs font-medium text-green-strong">
                        {r.addedToLibrary}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate">{d.description}</p>
                </>
              )}
              {d.issues.length > 0 && (
                <ul className="mt-2 text-xs text-slate">
                  {d.issues.map((issue) => (
                    <li key={draftIssueKey(issue)}>{draftIssueText(issue, t)}</li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex items-center gap-2">
                <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    aria-label={r.keepAria(d.name)}
                    checked={kept.has(d.key)}
                    disabled={added.has(d.key)}
                    onChange={() => onToggleKeep(d.key)}
                  />
                  {r.keep}
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={editing === d.key ? r.doneAria(d.name) : r.editAria(d.name)}
                  disabled={added.has(d.key)}
                  onClick={() => setEditing(editing === d.key ? null : d.key)}
                >
                  {editing === d.key ? r.done : r.edit}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {zoomed?.scene && (
        <DiagramLightbox diagrams={[sceneAsDiagram(zoomed.key, zoomed.scene)]} startIndex={0} onClose={() => setZoomed(null)} />
      )}
    </>
  );
}
