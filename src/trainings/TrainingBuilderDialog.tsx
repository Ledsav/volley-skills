import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, GripVertical, Trash2, TriangleAlert } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { useMediaQuery } from '../components/useMediaQuery';
import { OfflineError, useSave } from '../components/useSave';
import { FilterChips, ToggleChip } from '../components/Chip';
import { Sheet } from '../components/Sheet';
import { FIELD_LABEL_CLASS, Input, Textarea } from '../components/Input';
import { parseOptionalInt } from '../components/parseOptionalInt';
import { DiagramThumbnail } from '../diagrams/DiagramThumbnail';
import { ExerciseDetailSheet } from '../exercises/ExerciseDetailSheet';
import { getExercisesByIds, listExercises, listExercisesInCategories } from '../exercises/exercisesApi';
import { EXERCISE_CATEGORIES, PLAYER_LIMITS, type Exercise, type ExerciseCategory } from '../types/exercise';
import type { NewTrainingInput, Training, TrainingExercise } from '../types/training';
import { moveRow, useRowReorder } from './reorder';
import { PlayersNote } from './PlayersNote';
import { coveredTargets, needsMorePlayers, sortByFit } from './suggestions';
import { createTraining, updateTraining } from './trainingsApi';
import { trainingNameExample, trainingNameHint } from './naming';
import { useT } from '../i18n/I18nProvider';

const FORM_ID = 'training-form';

const rowIconBtn =
  'inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-30';

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
  // Plan edits made with buttons or drag don't bubble a change event, so they arm the discard guard here.
  // A draft prefill is unsaved work from the start (its new exercises are already saved, the plan is not).
  const [touched, setTouched] = useState(
    !training && Boolean(initial && (initial.exercises.length > 0 || initial.name))
  );

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
    setTouched(true);
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
    setTouched(true);
    setTargets((current) =>
      current.includes(key)
        ? current.filter((target) => target !== key)
        : EXERCISE_CATEGORIES.map((c) => c.key).filter((k) => k === key || current.includes(k))
    );
  }

  function move(index: number, delta: number) {
    setTouched(true);
    setRows((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      return moveRow(current, index, target);
    });
  }

  const { listRef, handleProps, rowStyle } = useRowReorder({
    count: rows.length,
    onMove: (from, to) => {
      setTouched(true);
      setRows((current) => moveRow(current, from, to));
    },
  });

  function removeRow(index: number) {
    setTouched(true);
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
  // A wide screen keeps the exercise library open beside the plan (mockup); a phone opens it below on demand.
  const wide = useMediaQuery('(min-width: 1024px)', false);
  const libraryOpen = pickerOpen || wide;
  useEffect(() => {
    if (wide && !pickerOpen) openPicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wide]);

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
            updateTraining(
              training.id,
              {
                ...fields,
                suggestedPlayers: suggestedPlayers.value,
                targets: targets.length > 0 ? targets : null,
              },
              training.businessId
            )
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

  const hairline =
    'relative before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden';

  function renderPickerItem(ex: Exercise, section: 'suggested' | 'all') {
    const expandKey = `${section}:${ex.id}`;
    const expanded = expandedId === expandKey;
    return (
      <li key={ex.id} className={`${hairline} py-1 pr-3`}>
        <div className="flex items-start gap-1">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? m.collapse(ex.name) : m.expand(ex.name)}
            onClick={() => setExpandedId(expanded ? null : expandKey)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <div className="min-w-0 flex-1 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-callout font-medium text-ink">{ex.name}</span>
              <span className="rounded-full bg-surface-3 px-2.5 text-caption text-ink-2">
                {lb.exerciseCategory[ex.category]}
              </span>
              <PlayersNote minPlayers={ex.minPlayers} suggested={suggestedPlayersValue} />
            </div>
            {ex.description && !expanded && (
              <p className="mt-0.5 line-clamp-1 text-footnote text-ink-2">{ex.description}</p>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => addExercise(ex)}
            aria-label={m.addNamed(ex.name)}
            className="mt-1 shrink-0"
          >
            {m.add}
          </Button>
        </div>
        {expanded && (
          <div className="mb-2 flex gap-3 pl-12">
            <DiagramThumbnail
              exerciseId={ex.id}
              className="aspect-square w-24 shrink-0 overflow-hidden rounded-sm bg-surface"
            />
            <p className="text-footnote text-ink-2">{ex.description || m.noDescription}</p>
          </div>
        )}
      </li>
    );
  }

  const fieldLabel = FIELD_LABEL_CLASS;
  const hint = 'mt-1 text-footnote text-ink-2';

  return (
    <Sheet
      guardUnsaved
      dirty={touched}
      title={training ? `${training.businessId} · ${training.name}` : m.newTitle}
      size="lg"
      detent="large"
      onClose={onClose}
      confirm={{ label: saving ? m.saving : m.save, form: FORM_ID, disabled: saving }}
    >
      <form id={FORM_ID} onSubmit={handleSubmit} aria-label={training ? m.editLabel : m.newTitle}>
        <label htmlFor="training-name" className={fieldLabel}>
          {m.name}
        </label>
        <Input
          id="training-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={trainingNameExample()}
          aria-describedby="training-name-hint"
        />
        <p id="training-name-hint" className={hint}>
          {trainingNameHint()}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="training-age" className={fieldLabel}>
              {m.ageGroupTarget}
            </label>
            <Input id="training-age" value={ageGroupTarget} onChange={(e) => setAgeGroupTarget(e.target.value)} />
          </div>
          <div>
            <label htmlFor="training-suggested-players" className={fieldLabel}>
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
            <p id="training-suggested-players-hint" className={hint}>
              {m.suggestedPlayersHint}
            </p>
          </div>
        </div>

        <span id="training-targets-label" className={`${fieldLabel} mt-4`}>
          {m.targets}
        </span>
        <div role="group" aria-label={m.targetsGroup} className="flex flex-wrap gap-2">
          {EXERCISE_CATEGORIES.map((c) => {
            const isCovered = covered.has(c.key);
            return (
              <ToggleChip
                key={c.key}
                pressed={targets.includes(c.key)}
                ariaLabel={isCovered ? m.covered(lb.exerciseCategory[c.key]) : lb.exerciseCategory[c.key]}
                onToggle={() => toggleTarget(c.key)}
                label={lb.exerciseCategory[c.key]}
                icon={isCovered ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : undefined}
              />
            );
          })}
        </div>

        <label htmlFor="training-description" className={`${fieldLabel} mt-4`}>
          {m.description}
        </label>
        <Textarea
          id="training-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className={`mt-6 ${wide ? 'grid grid-cols-[minmax(0,1fr)_17rem] items-start gap-4' : ''}`}>
          <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-title-3 text-ink">{m.exercises}</span>
            <span className="text-callout tabular-nums text-ink-2">{m.summary(rows.length, totalMinutes)}</span>
          </div>

          <ul aria-label={m.exercisesList} ref={listRef} className="rounded-lg bg-surface-2">
            {rows.length === 0 && <li className="p-3 text-callout text-ink-2">{m.noExercises}</li>}
            {rows.map((row, i) => {
              const startMinute = rows.slice(0, i).reduce((sum, r) => sum + (r.durationMinutes || 0), 0);
              const dragStyle = rowStyle(i);
              return (
                <li
                  key={`${row.exerciseId}-${i}`}
                  style={dragStyle}
                  className={`${hairline} px-2 py-1 ${dragStyle ? 'z-10 rounded-lg bg-surface shadow-pop' : ''}`}
                >
                  {/* The whole summary is one tap target that opens the exercise
                      full-screen; editing controls sit on their own row below. */}
                  <div className="flex items-center">
                    <div
                      aria-hidden="true"
                      {...handleProps(i)}
                      className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-ink-3"
                    >
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewing(i)}
                      aria-label={m.viewExercise(i + 1, row.name)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left hover:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-caption font-semibold tabular-nums text-ink">
                        {i + 1}
                      </span>
                      <DiagramThumbnail
                        exerciseId={row.exerciseId}
                        interactive={false}
                        className="aspect-square w-14 shrink-0 overflow-hidden rounded-sm bg-surface"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-headline ${row.name ? 'text-ink' : 'text-red-strong'}`}>
                          {row.name ?? (
                            <span className="inline-flex items-center gap-1">
                              <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                              {m.deletedExercise}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-footnote tabular-nums text-ink-2">
                          {row.category ? `${lb.exerciseCategory[row.category]} · ` : ''}{m.exerciseTiming(startMinute, startMinute + (row.durationMinutes || 0))}
                        </span>
                        {needsMorePlayers(row.minPlayers, suggestedPlayersValue) && (
                          <span className="mt-0.5 block">
                            <PlayersNote minPlayers={row.minPlayers} suggested={suggestedPlayersValue} />
                          </span>
                        )}
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-ink-3" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 pl-8">
                    <label className="mr-auto flex items-center gap-1.5 text-footnote text-ink-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        aria-label={m.durationLabel(i + 1)}
                        value={row.durationMinutes}
                        onChange={(e) => setDuration(i, Number(e.target.value))}
                        className="min-h-11 w-16 rounded-md border border-transparent bg-surface px-2 py-1 text-right text-base tabular-nums text-ink focus:border-focus focus:outline-none sm:text-body"
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
                      className={`${rowIconBtn} !text-red-strong`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          </div>

          {libraryOpen ? (
            <div
              className={
                wide
                  ? 'scroll-quiet sticky top-0 max-h-[60vh] overflow-y-auto overscroll-contain rounded-lg bg-surface-2 p-3'
                  : 'mt-3 rounded-lg bg-surface-2 p-3'
              }
            >
              <div className="mb-2 flex min-h-11 items-center justify-between">
                <p className="text-headline text-ink">{m.pickExercise}</p>
                {!wide && (
                  <Button variant="ghost" onClick={() => setPickerOpen(false)} className="min-h-11">
                    {m.done}
                  </Button>
                )}
              </div>

              <FilterChips
                label={m.filterByCategory}
                value={pickerCategory}
                onChange={selectCategory}
                className="mb-2 pb-1 !-mx-3 !px-3"
                options={[
                  { id: '' as ExerciseCategory | '', label: m.all },
                  ...EXERCISE_CATEGORIES.map((c) => ({ id: c.key as ExerciseCategory | '', label: lb.exerciseCategory[c.key] })),
                ]}
              />

              {showSuggested && (
                <>
                  <p id="picker-suggested" className="mb-1 text-callout font-medium text-ink">
                    {m.suggestedForTargets}
                  </p>
                  <ul aria-labelledby="picker-suggested" className="mb-2 rounded-lg bg-surface">
                    {suggested.length === 0 && (
                      <li className="p-3 text-callout text-ink-2">{m.noneForTargets}</li>
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
                  <p className="mb-1 mt-2 text-callout font-medium text-ink">{m.allExercises}</p>
                </>
              )}
              <ul className="rounded-lg bg-surface">
                {picker.length === 0 && (
                  <li className="p-3 text-callout text-ink-2">{m.noneInCategory}</li>
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
            <Button variant="secondary" size="sm" onClick={openPicker} className="mt-3">
              {m.addExercise}
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-callout text-red-strong">
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
    </Sheet>
  );
}
