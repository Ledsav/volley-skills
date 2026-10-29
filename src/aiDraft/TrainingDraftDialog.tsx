import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AI_MAX_TOKENS, DRAFT_TEMPERATURE, chatJson } from '../ai/aiClient';
import { readAiSettings } from '../ai/aiSettings';
import { Button } from '../components/Button';
import { ToggleChip } from '../components/Chip';
import { Sheet, SheetCancelButton } from '../components/Sheet';
import { Input, Textarea } from '../components/Input';
import { OfflineError, useSave } from '../components/useSave';
import { ExerciseDetailSheet, type ExerciseDetailEntry } from '../exercises/ExerciseDetailSheet';
import { parseOptionalInt } from '../components/parseOptionalInt';
import { EXERCISE_CATEGORIES, PLAYER_LIMITS, type ExerciseCategory } from '../types/exercise';
import type { NewTrainingInput } from '../types/training';
import { draftErrorText, needsSettings, runDraft, type AskFn } from './draftRunner';
import { loadLibraryIndex } from './libraryIndex';
import { NumberField } from './NumberField';
import { DraftSaveError, newExercisesOf, saveExerciseDrafts, saveTrainingDraft, trainingDraftToInput } from './saveDrafts';
import { buildTrainingMessages } from './trainingPrompt';
import { TrainingProposalReview } from './TrainingProposalReview';
import { DRAFT_LIMITS, type TrainingDraft } from './types';
import { validateTrainingProposal } from './validateDraft';
import { useT } from '../i18n/I18nProvider';
import { draftSaveErrorText } from './draftMessages';

interface Props {
  onClose: () => void;
  onSaved: (businessId: string) => void;
  /** Called after the draft's new exercises are saved, with real exercise ids only. */
  onOpenInBuilder: (initial: NewTrainingInput) => void;
  /** Test seam; defaults to the coach's provider from Settings. */
  ask?: AskFn;
}

type DraftError = { text: string; settingsLink: boolean };

function toEntries(draft: TrainingDraft): ExerciseDetailEntry[] {
  return draft.steps.map((s) =>
    s.kind === 'library'
      ? { exerciseId: s.exerciseId, name: s.name, description: s.description, category: s.category, durationMinutes: s.minutes }
      : {
          exerciseId: s.exercise.key,
          name: s.exercise.name,
          description: s.exercise.description,
          category: s.exercise.category ?? undefined,
          durationMinutes: s.minutes,
          scene: s.exercise.scene,
        },
  );
}

export function TrainingDraftDialog({ onClose, onSaved, onOpenInBuilder, ask }: Props) {
  const catalog = useT();
  const lb = catalog.labels;
  const t = catalog.aiDraft;
  const td = t.trainingDialog;
  const cancel = catalog.common.cancel;
  const saveErrorText = (e: unknown) =>
    e instanceof OfflineError
      ? t.saveErrors.offlineTraining
      : e instanceof DraftSaveError
        ? draftSaveErrorText(e.issue, t)
        : catalog.common.couldNotSave;
  const { firebaseUser, access } = useAuth();
  // New exercises can only be created by coaches who can write the exercise library.
  const canWriteExercises = !!access?.sections.exercises;
  const [settings] = useState(readAiSettings);
  const askModel: AskFn =
    ask ??
    ((messages, signal) =>
      chatJson(settings, messages, { signal, temperature: DRAFT_TEMPERATURE, maxTokens: AI_MAX_TOKENS.draft }));
  const [goal, setGoal] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [minutes, setMinutes] = useState(90);
  const [allowNew, setAllowNew] = useState(true);
  const [playersText, setPlayersText] = useState('');
  const [targets, setTargets] = useState<ExerciseCategory[]>([]);
  const [draft, setDraft] = useState<TrainingDraft | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<DraftError | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  // Draft key → saved exercise id; survives a failed save so a retry never duplicates.
  const createdRef = useRef(new Map<string, string>());
  const { saving, save } = useSave();

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function generate() {
    if (!goal.trim()) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setGenerating(true);
    setError(null);
    const newAllowed = allowNew && canWriteExercises;
    const players = parseOptionalInt(playersText, PLAYER_LIMITS.suggestedPlayers.min, PLAYER_LIMITS.suggestedPlayers.max);
    const suggestedPlayers = players.ok ? players.value : null;
    try {
      const index = await loadLibraryIndex(goal, targets);
      const messages = buildTrainingMessages({
        goal: goal.trim(),
        ageGroupTarget: ageGroup.trim(),
        totalMinutes: minutes,
        allowNew: newAllowed,
        index,
        targets,
        suggestedPlayers,
      });
      const next = await runDraft(
        () => askModel(messages, controller.signal),
        (raw) =>
          validateTrainingProposal(raw, { index, allowNew: newAllowed, ageGroupTarget: ageGroup.trim(), targets, suggestedPlayers }),
      );
      if (!controller.signal.aborted) setDraft(next);
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

  const canSave = !!draft && draft.name.trim().length > 0 && draft.steps.length > 0 && !saving && !generating && !!firebaseUser;

  async function handleSave() {
    if (!draft || !firebaseUser || !canSave) return;
    setError(null);
    let businessId = '';
    try {
      const done = await save(
        async () => {
          businessId = (await saveTrainingDraft(draft, firebaseUser.uid, createdRef.current)).businessId;
        },
        { offline: 'block' },
      );
      if (done) onSaved(businessId);
    } catch (e) {
      setError({ text: saveErrorText(e), settingsLink: false });
    }
  }

  async function handleOpenInBuilder() {
    if (!draft || !firebaseUser || !canSave) return;
    setError(null);
    try {
      const done = await save(() => saveExerciseDrafts(newExercisesOf(draft), firebaseUser.uid, createdRef.current), {
        offline: 'block',
      });
      if (done) onOpenInBuilder(trainingDraftToInput(draft, createdRef.current));
    } catch (e) {
      setError({ text: saveErrorText(e), settingsLink: false });
    }
  }

  const footer = generating ? (
    <Button variant="secondary" onClick={cancelGenerate}>
      {cancel}
    </Button>
  ) : draft ? (
    <>
      <Button variant="secondary" className="mr-auto" onClick={() => void generate()}>
        {t.regenerate}
      </Button>
      <SheetCancelButton className="hidden md:inline-flex" />
      <Button variant="secondary" onClick={() => void handleOpenInBuilder()} disabled={!canSave}>
        {td.openInBuilder}
      </Button>
      <Button variant="primary" onClick={() => void handleSave()} disabled={!canSave}>
        {saving ? t.saving : catalog.common.save}
      </Button>
    </>
  ) : (
    <>
      <SheetCancelButton className="hidden md:inline-flex" />
      <Button variant="primary" onClick={() => void generate()} disabled={!goal.trim()}>
        {t.generate}
      </Button>
    </>
  );

  return (
    <Sheet title={td.title} size="lg" detent="large" dirty={draft !== null} onClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4">
        {!draft && (
          <>
            <div>
              <label htmlFor="tdraft-goal" className="mb-1 block text-callout font-medium text-ink">
                {td.goal}
              </label>
              <Textarea
                id="tdraft-goal"
                rows={3}
                maxLength={DRAFT_LIMITS.requestMax}
                placeholder={td.goalPlaceholder}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
              <p className="mt-1 text-footnote text-ink-2">
                {td.privacy}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tdraft-age-in" className="mb-1 block text-callout font-medium text-ink">
                  {td.ageGroup}
                </label>
                <Input id="tdraft-age-in" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} />
              </div>
              <div>
                <label htmlFor="tdraft-min" className="mb-1 block text-callout font-medium text-ink">
                  {td.totalMinutes}
                </label>
                <NumberField id="tdraft-min" min={30} max={180} value={minutes} onChange={setMinutes} />
              </div>
            </div>
            <div>
              <label htmlFor="tdraft-players" className="mb-1 block text-callout font-medium text-ink">
                {td.suggestedPlayers}
              </label>
              <Input
                id="tdraft-players"
                type="text"
                inputMode="numeric"
                value={playersText}
                onChange={(e) => setPlayersText(e.target.value)}
                className="w-24"
              />
              <p className="mt-1 text-footnote text-ink-2">{td.suggestedPlayersHint}</p>
            </div>
            <div>
              <span className="mb-1 block text-callout font-medium text-ink">{td.targets}</span>
              <div role="group" aria-label={td.targets} className="flex flex-wrap gap-2">
                {EXERCISE_CATEGORIES.map((c) => {
                  return (
                    <ToggleChip
                      key={c.key}
                      pressed={targets.includes(c.key)}
                      label={lb.exerciseCategory[c.key]}
                      onToggle={() =>
                        setTargets((current) =>
                          current.includes(c.key)
                            ? current.filter((t) => t !== c.key)
                            : EXERCISE_CATEGORIES.map((x) => x.key).filter((k) => k === c.key || current.includes(k))
                        )
                      }
                    />
                  );
                })}
              </div>
            </div>
            {canWriteExercises && (
              <label className="flex min-h-11 items-center gap-2 text-callout text-ink">
                <input type="checkbox" className="h-4 w-4" checked={allowNew} onChange={(e) => setAllowNew(e.target.checked)} />
                {td.allowNew}
              </label>
            )}
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

        {draft && <TrainingProposalReview draft={draft} targetMinutes={minutes} onChange={setDraft} onView={setViewing} />}
      </div>

      {draft && viewing !== null && (
        <ExerciseDetailSheet entries={toEntries(draft)} startIndex={viewing} onClose={() => setViewing(null)} />
      )}
    </Sheet>
  );
}
