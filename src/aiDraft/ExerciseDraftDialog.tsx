import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AI_MAX_TOKENS, DRAFT_TEMPERATURE, chatJson } from '../ai/aiClient';
import { readAiSettings } from '../ai/aiSettings';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { SheetCancelButton } from '../components/Sheet';
import { FIELD_CLASS, Input, Textarea } from '../components/Input';
import { OfflineError, useSave } from '../components/useSave';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../types/exercise';
import { draftErrorText, needsSettings, runDraft, type AskFn } from './draftRunner';
import { buildExerciseMessages } from './exercisePrompt';
import { ExerciseProposalReview, type ExerciseDraftPatch } from './ExerciseProposalReview';
import { existingExerciseNames } from './libraryIndex';
import { DraftSaveError, saveExerciseDrafts } from './saveDrafts';
import { DRAFT_LIMITS, type ExerciseDraft } from './types';
import { validateExerciseProposals } from './validateDraft';
import { useT } from '../i18n/I18nProvider';
import { draftSaveErrorText } from './draftMessages';

interface Props {
  onClose: () => void;
  onSaved: (count: number) => void;
  /** Test seam; defaults to the coach's provider from Settings. */
  ask?: AskFn;
}

type DraftError = { text: string; settingsLink: boolean };

export function ExerciseDraftDialog({ onClose, onSaved, ask }: Props) {
  const catalog = useT();
  const lb = catalog.labels;
  const t = catalog.aiDraft;
  const cancel = catalog.common.cancel;
  const { firebaseUser } = useAuth();
  const [settings] = useState(readAiSettings);
  const askModel: AskFn =
    ask ??
    ((messages, signal) =>
      chatJson(settings, messages, { signal, temperature: DRAFT_TEMPERATURE, maxTokens: AI_MAX_TOKENS.draft }));
  const [request, setRequest] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | ''>('');
  const [count, setCount] = useState(3);
  const [drafts, setDrafts] = useState<ExerciseDraft[] | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<DraftError | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  // Draft key → saved exercise id; survives a failed save so a retry never duplicates.
  const createdRef = useRef(new Map<string, string>());
  const { saving, save } = useSave();

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function generate(keepCurrent: boolean) {
    const keptDrafts = keepCurrent && drafts ? drafts.filter((d) => kept.has(d.key)) : [];
    const wanted = count - keptDrafts.length;
    if (wanted < 1 || !request.trim()) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setGenerating(true);
    setError(null);
    try {
      const existingNames = await existingExerciseNames(category || null);
      const messages = buildExerciseMessages({
        request: request.trim(),
        category: category || null,
        count: wanted,
        existingNames,
        alreadyProposed: keptDrafts.map((d) => d.name),
      });
      const fresh = await runDraft(
        () => askModel(messages, controller.signal),
        (raw) => validateExerciseProposals(raw, wanted),
      );
      if (controller.signal.aborted) return;
      const next = [...keptDrafts, ...fresh];
      setDrafts(next);
      setKept(new Set(next.map((d) => d.key)));
    } catch (e) {
      if (!controller.signal.aborted) setError({ text: draftErrorText(e), settingsLink: needsSettings(e) });
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setGenerating(false);
      }
    }
  }

  function cancelGenerate() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setGenerating(false);
  }

  function toggleKeep(key: string) {
    setKept((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function edit(key: string, patch: ExerciseDraftPatch) {
    setDrafts((cur) =>
      cur
        ? cur.map((d) =>
            d.key !== key
              ? d
              : { ...d, ...patch, issues: patch.category ? d.issues.filter((i) => i.code !== 'pickCategory') : d.issues },
          )
        : cur,
    );
  }

  const toSave = drafts?.filter((d) => kept.has(d.key) && !added.has(d.key)) ?? [];
  const canSave = toSave.length > 0 && toSave.every((d) => d.category && d.name.trim()) && !saving && !generating;

  async function handleSave() {
    if (!firebaseUser || !canSave) return;
    setError(null);
    try {
      const done = await save(() => saveExerciseDrafts(toSave, firebaseUser.uid, createdRef.current), { offline: 'block' });
      // Every exercise this dialog created, including ones from an earlier, partly failed save.
      if (done) onSaved(createdRef.current.size);
    } catch (e) {
      setAdded(new Set(createdRef.current.keys()));
      setError({
        text:
          e instanceof OfflineError
            ? t.saveErrors.offlineExercises
            : e instanceof DraftSaveError
              ? draftSaveErrorText(e.issue, t)
              : catalog.common.couldNotSave,
        settingsLink: false,
      });
    }
  }

  const footer = generating ? (
    <Button variant="secondary" onClick={cancelGenerate}>
      {cancel}
    </Button>
  ) : drafts ? (
    <>
      <Button variant="secondary" className="mr-auto" onClick={() => void generate(true)} disabled={kept.size >= count}>
        {t.regenerate}
      </Button>
      <SheetCancelButton className="hidden md:inline-flex" />
      <Button variant="primary" onClick={() => void handleSave()} disabled={!canSave}>
        {saving ? t.saving : t.exerciseDialog.saveKept(toSave.length)}
      </Button>
    </>
  ) : (
    <>
      <SheetCancelButton className="hidden md:inline-flex" />
      <Button variant="primary" onClick={() => void generate(false)} disabled={!request.trim()}>
        {t.generate}
      </Button>
    </>
  );

  return (
    <Dialog title={t.exerciseDialog.title} size="lg" mobileSheet dirty={drafts !== null} onClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4">
        {!drafts && (
          <>
            <div>
              <label htmlFor="draft-request" className="mb-1 block text-callout font-medium text-ink">
                {t.exerciseDialog.request}
              </label>
              <Textarea
                id="draft-request"
                rows={3}
                maxLength={DRAFT_LIMITS.requestMax}
                placeholder={t.exerciseDialog.requestPlaceholder}
                value={request}
                onChange={(e) => setRequest(e.target.value)}
              />
              <p className="mt-1 text-footnote text-ink-2">
                {t.exerciseDialog.privacy}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="draft-category" className="mb-1 block text-callout font-medium text-ink">
                  {t.exerciseDialog.category}
                </label>
                <select
                  id="draft-category"
                  className={`${FIELD_CLASS} min-h-11 w-full`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExerciseCategory | '')}
                >
                  <option value="">{t.exerciseDialog.any}</option>
                  {EXERCISE_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {lb.exerciseCategory[c.key]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="draft-count" className="mb-1 block text-callout font-medium text-ink">
                  {t.exerciseDialog.howMany}
                </label>
                <Input
                  id="draft-count"
                  type="number"
                  min={1}
                  max={DRAFT_LIMITS.maxProposals}
                  value={count}
                  onChange={(e) =>
                    setCount(Math.max(1, Math.min(DRAFT_LIMITS.maxProposals, Number(e.target.value) || 1)))
                  }
                />
              </div>
            </div>
          </>
        )}

        {generating && (
          <p role="status" className="text-callout text-ink-2">
            {t.drafting}
          </p>
        )}

        {error && (
          <p role="alert" className="text-callout text-red-strong">
            {error.text}{' '}
            {error.settingsLink && (
              <Link to="/settings" className="text-ink underline-offset-2 hover:underline">
                {t.openSettings}
              </Link>
            )}
          </p>
        )}

        {drafts && <ExerciseProposalReview drafts={drafts} kept={kept} added={added} onToggleKeep={toggleKeep} onEdit={edit} />}
      </div>
    </Dialog>
  );
}
