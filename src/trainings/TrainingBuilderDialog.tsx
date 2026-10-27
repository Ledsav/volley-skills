import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Trash2, TriangleAlert } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { OfflineError, useSave } from '../components/useSave';
import { Dialog } from '../components/Dialog';
import { Input, Textarea } from '../components/Input';
import { parseOptionalInt } from '../components/parseOptionalInt';
import { DiagramThumbnail } from '../diagrams/DiagramThumbnail';
import { ExerciseDetailSheet } from '../exercises/ExerciseDetailSheet';
import { getExercisesByIds, listExercises, listExercisesInCategories } from '../exercises/exercisesApi';
import { EXERCISE_CATEGORIES, PLAYER_LIMITS, type Exercise, type ExerciseCategory } from '../types/exercise';
import type { NewTrainingInput, Training, TrainingExercise } from '../types/training';
import { PlayersNote } from './PlayersNote';
import { coveredTargets, needsMorePlayers, sortByFit } from './suggestions';
import { createTraining, updateTraining } from './trainingsApi';
import { trainingNameExample, trainingNameHint } from './naming';
import { useT } from '../i18n/I18nProvider';

const chipClass = (active: boolean) =>
  `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
    active ? 'bg-blue text-white' : 'border border-border bg-surface text-slate hover:bg-bg'
  }`;

const FORM_ID = 'training-form';

const rowIconBtn =
  'inline-flex h-11 w-11 items-center justify-center rounded-md text-slate hover:bg-bg hover:text-ink disabled:opacity-30 sm:h-9 sm:w-9';

interface Row extends TrainingExercise {
  name: string | null; // null => the exercise no longer exists
  description: string;
  category?: ExerciseCategory;
  minPlayers?: number;
}

interface TrainingBuilderDialogProps {
  training?: Training;
  /** Prefill a NEW training (e.g. from an AI draft). Ignored when `training` is set. */
  initial?: NewTrainingInput;
  onClose: () => void;
  onSaved: () => void;
}

export function TrainingBuilderDialog({ training, initial, onClose, onSaved }: TrainingBuilderDialogProps) {
  const t = useT();
  const lb = t.labels;
  const m = t.trainings.builder;
  const { firebaseUser } = useAuth();
  const [name, setName] = useState(training?.name ?? initial?.name ?? '');
  const [description, setDescription] = useState(training?.description ?? initial?.description ?? '');
  const [ageGroupTarget, setAgeGroupTarget] = useState(training?.ageGroupTarget ?? initial?.ageGroupTarget ?? '');
  const [suggestedPlayersText, setSuggestedPlayersText] = useState(
    (training?.suggestedPlayers ?? initial?.suggestedPlayers)?.toString() ?? ''
  );
  const [targets, setTargets] = useState<ExerciseCategory[]>(training?.targets ?? initial?.targets ?? []);
  const [rows, setRows] = useState<Row[]>([]);
  const [picker, setPicker] = useState<Exercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<ExerciseCategory | ''>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [pickerLastDoc, setPickerLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [pickerHasMore, setPickerHasMore] = useState(false);
  const [suggested, setSuggested] = useState<Exercise[]>([]);
  const [suggestedLastDoc, setSuggestedLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [suggestedHasMore, setSuggestedHasMore] = useState(false);
  // Bumped whenever the targets change, so an answer to an older suggestions query is dropped.
  const suggestRequest = useRef(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const source = training?.exercises ?? initial?.exercises;
    if (!source || source.length === 0) return;
    void getExercisesByIds(source.map((e) => e.exerciseId))
      .then((found) => {
        const byId = new Map(found.map((ex) => [ex.id, ex]));
        setRows(
          source
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((e) => ({
              ...e,
              name: byId.get(e.exerciseId)?.name ?? null,
              description: byId.get(e.exerciseId)?.description ?? '',
              category: byId.get(e.exerciseId)?.category,
              minPlayers: byId.get(e.exerciseId)?.minPlayers,
            }))
        );
      })
      .catch(() => setError(m.loadExercisesError));
    // `initial` is a one-shot prefill; re-running on its identity would wipe the coach's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [training]);

  async function loadPicker(category: ExerciseCategory | '', afterDoc: QueryDocumentSnapshot | null) {
    try {
      const page = await listExercises(afterDoc, category || null);
      setPicker((current) => (afterDoc ? [...current, ...page.exercises] : page.exercises));
      setPickerLastDoc(page.lastDoc);
      setPickerHasMore(page.exercises.length > 0 && page.lastDoc !== null);
    } catch {
      setError(
        afterDoc ? m.loadMoreExercisesError : m.loadPickerError
      );
    }
  }

  async function loadSuggested(categories: ExerciseCategory[], afterDoc: QueryDocumentSnapshot | null) {
    const request = suggestRequest.current;
    try {
      const page = await listExercisesInCategories(categories, afterDoc);
      if (request !== suggestRequest.current) return;
      setSuggested((current) => (afterDoc ? [...current, ...page.exercises] : page.exercises));
      setSuggestedLastDoc(page.lastDoc);
      setSuggestedHasMore(page.hasMore);
    } catch {
      if (request === suggestRequest.current) setError(m.loadSuggestedError);
    }
  }

  // Suggestions follow the targets: reload from the first page whenever they change while picking.
  const targetsKey = targets.join(',');
  useEffect(() => {
    suggestRequest.current += 1;
    setSuggested([]);
    setSuggestedLastDoc(null);
    setSuggestedHasMore(false);
    if (pickerOpen && targets.length > 0) void loadSuggested(targets, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen, targetsKey]);

  function openPicker() {
    setPickerOpen(true);
    void loadPicker(pickerCategory, null);
  }

  function selectCategory(category: ExerciseCategory | '') {
    setPickerCategory(category);
    setExpandedId(null);
    setPicker([]);
    setPickerLastDoc(null);
    setPickerHasMore(false);
    void loadPicker(category, null);
  }

  function addExercise(exercise: Exercise) {
    setRows((current) => [
      ...current,
      {
        exerciseId: exercise.id,
        order: current.length + 1,
        durationMinutes: 10,
        name: exercise.name,
        description: exercise.description,
        category: exercise.category,
        minPlayers: exercise.minPlayers,
      },
    ]);
    // Picker stays open so several exercises can be added in one pass.
  }

  function toggleTarget(key: ExerciseCategory) {
    setTargets((current) =>
      current.includes(key)
        ? current.filter((target) => target !== key)
        : EXERCISE_CATEGORIES.map((c) => c.key).filter((k) => k === key || current.includes(k))
    );
  }

  function move(index: number, delta: number) {
    setRows((current) => {
      const next = current.slice();
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function setDuration(index: number, value: number) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, durationMinutes: value } : row)));
  }

  const totalMinutes = useMemo(() => rows.reduce((sum, r) => sum + (r.durationMinutes || 0), 0), [rows]);

  const suggestedPlayersValue = useMemo(() => {
    const { min, max } = PLAYER_LIMITS.suggestedPlayers;
    const parsed = parseOptionalInt(suggestedPlayersText, min, max);
    return parsed.ok ? parsed.value : null;
  }, [suggestedPlayersText]);
  const covered = useMemo(() => coveredTargets(targets, rows), [targets, rows]);
  const showSuggested = targets.length > 0 && pickerCategory === '';

  const { saving, save } = useSave();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError(m.nameRequired);
      return;
    }
    const { min, max } = PLAYER_LIMITS.suggestedPlayers;
    const suggestedPlayers = parseOptionalInt(suggestedPlayersText, min, max);
    if (!suggestedPlayers.ok) {
      setError(m.suggestedPlayersRange(min, max));
      return;
    }
    setError(null);
    const exercises: TrainingExercise[] = rows.map((row, i) => ({
      exerciseId: row.exerciseId,
      order: i + 1,
      durationMinutes: row.durationMinutes,
    }));
    const uid = firebaseUser?.uid;
    if (!training && !uid) return;
    const fields = { name: name.trim(), description, ageGroupTarget, exercises };
    try {
      const done = training
        ? await save(() =>
            updateTraining(training.id, {
              ...fields,
              suggestedPlayers: suggestedPlayers.value,
              targets: targets.length > 0 ? targets : null,
            })
          )
        : await save(
            () =>
              createTraining(
                {
                  ...fields,
                  suggestedPlayers: suggestedPlayers.value ?? undefined,
                  targets: targets.length > 0 ? targets : undefined,
                },
                uid ?? ''
              ),
            { offline: 'block' }
          );
      if (!done) return;
      onSaved();
    } catch (e) {
      setError(e instanceof OfflineError ? m.offline : m.saveError);
    }
  }

  function renderPickerItem(ex: Exercise, section: 'suggested' | 'all') {
    const expandKey = `${section}:${ex.id}`;
    const expanded = expandedId === expandKey;
    return (
      <li key={ex.id} className="py-2">
        <div className="flex items-start gap-2">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? m.collapse(ex.name) : m.expand(ex.name)}
            onClick={() => setExpandedId(expanded ? null : expandKey)}
            className="mt-0.5 shrink-0 rounded-sm text-slate hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="text-sm font-medium text-ink">{ex.name}</span>
              <span className="rounded-sm bg-blue/10 px-1.5 py-0.5 text-xs font-medium text-blue">
                {lb.exerciseCategory[ex.category]}
              </span>
              <PlayersNote minPlayers={ex.minPlayers} suggested={suggestedPlayersValue} />
            </div>
            {ex.description && !expanded && (
              <p className="mt-0.5 line-clamp-1 text-xs text-slate">{ex.description}</p>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => addExercise(ex)}
            aria-label={m.addNamed(ex.name)}
            className="shrink-0"
          >
            {m.add}
          </Button>
        </div>
        {expanded && (
          <div className="mt-2 flex gap-3 pl-6">
            <DiagramThumbnail
              exerciseId={ex.id}
              className="aspect-square w-24 shrink-0 overflow-hidden rounded-sm border border-border"
            />
            <p className="text-xs text-slate">{ex.description || m.noDescription}</p>
          </div>
        )}
      </li>
    );
  }

  return (
    <Dialog
      guardUnsaved
      title={training ? `${training.businessId} · ${training.name}` : m.newTitle}
      size="lg"
      mobileSheet
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-sm tabular-nums text-slate">
            {m.summary(rows.length, totalMinutes)}
          </span>
          <Button variant="ghost" onClick={onClose} className="hidden sm:inline-flex">
            {m.cancel}
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={saving}>
            {saving ? m.saving : m.save}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} aria-label={training ? m.editLabel : m.newTitle}>
        <label htmlFor="training-name" className="mb-1 block text-sm font-medium text-ink">
          {m.name}
        </label>
        <Input
          id="training-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={trainingNameExample()}
          aria-describedby="training-name-hint"
        />
        <p id="training-name-hint" className="mt-1 text-xs text-slate">
          {trainingNameHint()}
        </p>

        <label htmlFor="training-age" className="mb-1 mt-4 block text-sm font-medium text-ink">
          {m.ageGroupTarget}
        </label>
        <Input id="training-age" value={ageGroupTarget} onChange={(e) => setAgeGroupTarget(e.target.value)} />

        <label htmlFor="training-suggested-players" className="mb-1 mt-4 block text-sm font-medium text-ink">
          {m.suggestedPlayers}
        </label>
        <Input
          id="training-suggested-players"
          // Text, not type="number": a number input reports "" for input it can't parse
          // (e.g. "7,5"), which would read as "not set" instead of showing the error.
          type="text"
          inputMode="numeric"
          value={suggestedPlayersText}
          onChange={(e) => setSuggestedPlayersText(e.target.value)}
          aria-describedby="training-suggested-players-hint"
          className="w-24"
        />
        <p id="training-suggested-players-hint" className="mt-1 text-xs text-slate">
          {m.suggestedPlayersHint}
        </p>

        <span id="training-targets-label" className="mb-1 mt-4 block text-sm font-medium text-ink">
          {m.targets}
        </span>
        <div role="group" aria-label={m.targetsGroup} className="flex flex-wrap gap-1.5">
          {EXERCISE_CATEGORIES.map((c) => {
            const active = targets.includes(c.key);
            const isCovered = covered.has(c.key);
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={active}
                aria-label={isCovered ? m.covered(lb.exerciseCategory[c.key]) : lb.exerciseCategory[c.key]}
                onClick={() => toggleTarget(c.key)}
                className={`${chipClass(active)} inline-flex items-center gap-1`}
              >
                {isCovered && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                {lb.exerciseCategory[c.key]}
              </button>
            );
          })}
        </div>

        <label htmlFor="training-description" className="mb-1 mt-4 block text-sm font-medium text-ink">
          {m.description}
        </label>
        <Textarea
          id="training-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-ink">{m.exercises}</span>
          </div>

          <ul aria-label={m.exercisesList} className="divide-y divide-border rounded-md border border-border">
            {rows.length === 0 && <li className="p-3 text-sm text-slate">{m.noExercises}</li>}
            {rows.map((row, i) => {
              const startMinute = rows.slice(0, i).reduce((sum, r) => sum + (r.durationMinutes || 0), 0);
              return (
                <li key={`${row.exerciseId}-${i}`} className="p-2 sm:p-3">
                  {/* The whole summary is one tap target that opens the exercise
                      full-screen; editing controls sit on their own row below. */}
                  <button
                    type="button"
                    onClick={() => setViewing(i)}
                    aria-label={m.viewExercise(i + 1, row.name)}
                    className="flex w-full items-center gap-3 rounded-md p-1 text-left hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold tabular-nums text-white">
                      {i + 1}
                    </span>
                    <DiagramThumbnail
                      exerciseId={row.exerciseId}
                      interactive={false}
                      className="aspect-square w-14 shrink-0 overflow-hidden rounded-sm border border-border bg-surface"
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-medium ${row.name ? 'text-ink' : 'text-red'}`}>
                        {row.name ?? (
                          <span className="inline-flex items-center gap-1">
                            <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                            {m.deletedExercise}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs tabular-nums text-slate">
                        {row.category ? `${lb.exerciseCategory[row.category]} · ` : ''}{m.exerciseTiming(startMinute, startMinute + (row.durationMinutes || 0))}
                      </span>
                      {needsMorePlayers(row.minPlayers, suggestedPlayersValue) && (
                        <span className="mt-0.5 block">
                          <PlayersNote minPlayers={row.minPlayers} suggested={suggestedPlayersValue} />
                        </span>
                      )}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate" aria-hidden="true" />
                  </button>
                  <div className="mt-1 flex items-center gap-1 pl-1">
                    <label className="mr-auto flex items-center gap-1.5 text-xs text-slate">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        aria-label={m.durationLabel(i + 1)}
                        value={row.durationMinutes}
                        onChange={(e) => setDuration(i, Number(e.target.value))}
                        className="min-h-11 w-16 rounded-md border border-border bg-surface px-2 py-1 text-right text-base tabular-nums text-ink sm:min-h-0 sm:text-sm"
                      />
                      {m.min}
                    </label>
                    <button
                      type="button"
                      aria-label={m.moveUp(i + 1)}
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className={rowIconBtn}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={m.moveDown(i + 1)}
                      onClick={() => move(i, 1)}
                      disabled={i === rows.length - 1}
                      className={rowIconBtn}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={m.remove(i + 1)}
                      onClick={() => removeRow(i)}
                      className={`${rowIconBtn} text-red hover:text-red-strong`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {pickerOpen ? (
            <div className="mt-2 rounded-md border border-border p-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate">{m.pickExercise}</p>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="rounded-sm text-xs font-medium text-slate hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                >
                  {m.done}
                </button>
              </div>

              <div
                className="-mx-2 mb-2 flex gap-1.5 overflow-x-auto px-2 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
                role="group"
                aria-label={m.filterByCategory}
              >
                <button type="button" aria-pressed={pickerCategory === ''} onClick={() => selectCategory('')} className={chipClass(pickerCategory === '')}>
                  {m.all}
                </button>
                {EXERCISE_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={pickerCategory === c.key}
                    onClick={() => selectCategory(c.key)}
                    className={chipClass(pickerCategory === c.key)}
                  >
                    {lb.exerciseCategory[c.key]}
                  </button>
                ))}
              </div>

              {showSuggested && (
                <>
                  <p id="picker-suggested" className="mb-1 text-xs font-medium text-ink">
                    {m.suggestedForTargets}
                  </p>
                  <ul aria-labelledby="picker-suggested" className="mb-2 divide-y divide-border">
                    {suggested.length === 0 && (
                      <li className="py-2 text-sm text-slate">{m.noneForTargets}</li>
                    )}
                    {sortByFit(suggested, suggestedPlayersValue).map((ex) => renderPickerItem(ex, 'suggested'))}
                  </ul>
                  {suggestedHasMore && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void loadSuggested(targets, suggestedLastDoc)}
                      className="mb-2"
                    >
                      {m.loadMoreSuggestions}
                    </Button>
                  )}
                  <p className="mb-1 mt-2 text-xs font-medium text-ink">{m.allExercises}</p>
                </>
              )}
              <ul className="divide-y divide-border">
                {picker.length === 0 && (
                  <li className="py-2 text-sm text-slate">{m.noneInCategory}</li>
                )}
                {sortByFit(picker, suggestedPlayersValue).map((ex) => renderPickerItem(ex, 'all'))}
              </ul>
              {pickerHasMore && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void loadPicker(pickerCategory, pickerLastDoc)}
                  className="mt-2"
                >
                  {m.loadMore}
                </Button>
              )}
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={openPicker} className="mt-2">
              {m.addExercise}
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red">
            {error}
          </p>
        )}
      </form>

      {viewing !== null && (
        <ExerciseDetailSheet
          entries={rows.map((row) => ({
            exerciseId: row.exerciseId,
            name: row.name,
            description: row.description,
            category: row.category,
            durationMinutes: row.durationMinutes,
            minPlayers: row.minPlayers,
          }))}
          startIndex={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </Dialog>
  );
}
