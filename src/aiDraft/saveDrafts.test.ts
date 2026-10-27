import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as exercisesApi from '../exercises/exercisesApi';
import * as diagramsApi from '../diagrams/diagramsApi';
import * as trainingsApi from '../trainings/trainingsApi';
import { emptyScene } from '../diagrams/sceneFactory';
import { DraftSaveError, saveExerciseDrafts, saveTrainingDraft, trainingDraftToInput } from './saveDrafts';
import type { ExerciseDraft, TrainingDraft } from './types';

vi.mock('../exercises/exercisesApi');
vi.mock('../diagrams/diagramsApi');
vi.mock('../trainings/trainingsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const draft = (key: string, withScene = true): ExerciseDraft => ({
  key,
  name: `Name ${key}`,
  category: 'game',
  minPlayers: null,
  description: 'd',
  scene: withScene ? emptyScene('full') : null,
  issues: [],
});

describe('saveExerciseDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let n = 0;
    vi.mocked(exercisesApi.createExercise).mockImplementation(async () => `id-${++n}`);
    vi.mocked(diagramsApi.saveDiagramSet).mockResolvedValue({ idMap: {} });
  });

  it('creates each exercise, then its diagram titled "AI draft"', async () => {
    const ids = await saveExerciseDrafts([draft('a'), draft('b', false)], 'u1', new Map());
    expect(ids).toEqual(['id-1', 'id-2']);
    expect(exercisesApi.createExercise).toHaveBeenCalledWith({ name: 'Name a', category: 'game', description: 'd' }, 'u1');
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1);
    expect(vi.mocked(diagramsApi.saveDiagramSet).mock.calls[0][1].creates[0]).toMatchObject({ title: 'AI draft', order: 0 });
  });

  it('retry does not re-create exercises', async () => {
    const created = new Map<string, string>();
    vi.mocked(exercisesApi.createExercise).mockResolvedValueOnce('id-1').mockRejectedValueOnce(new Error('net'));
    await expect(saveExerciseDrafts([draft('a'), draft('b')], 'u1', created)).rejects.toMatchObject({ issue: { code: 'addFailed', name: 'Name b', added: ['Name a'] } });
    vi.mocked(exercisesApi.createExercise).mockResolvedValueOnce('id-2');
    await expect(saveExerciseDrafts([draft('a'), draft('b')], 'u1', created)).resolves.toEqual(['id-1', 'id-2']);
    expect(exercisesApi.createExercise).toHaveBeenCalledTimes(3);
  });

  it('reports an exercise saved without its diagram and stops', async () => {
    vi.mocked(diagramsApi.saveDiagramSet).mockRejectedValueOnce(new Error('rules'));
    const err = await saveExerciseDrafts([draft('a'), draft('b')], 'u1', new Map()).catch((e) => e);
    expect(err).toBeInstanceOf(DraftSaveError);
    expect(err.issue).toEqual({ code: 'diagramMissing', name: 'Name a', added: [] });
    expect(exercisesApi.createExercise).toHaveBeenCalledTimes(1);
  });

  it('refuses a draft without a category before writing anything', async () => {
    await expect(saveExerciseDrafts([{ ...draft('a'), category: null }], 'u1', new Map())).rejects.toMatchObject({ issue: { code: 'needsCategory', name: 'Name a', added: [] } });
    expect(exercisesApi.createExercise).not.toHaveBeenCalled();
  });
});

describe('saveTrainingDraft', () => {
  const training: TrainingDraft = {
    name: 'T',
    description: 'D',
    ageGroupTarget: 'U15',
    targets: [],
    suggestedPlayers: null,
    issues: [],
    steps: [
      { kind: 'library', exerciseId: 'lib-1', name: 'L', category: 'warmup', description: '', minutes: 10 },
      { kind: 'new', exercise: draft('n'), minutes: 20 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exercisesApi.createExercise).mockResolvedValue('new-1');
    vi.mocked(diagramsApi.saveDiagramSet).mockResolvedValue({ idMap: {} });
    vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't1', businessId: 'TR-0001' });
  });

  it('creates new exercises first, then the training with real ids in order', async () => {
    await expect(saveTrainingDraft(training, 'u1', new Map())).resolves.toEqual({ id: 't1', businessId: 'TR-0001' });
    expect(trainingsApi.createTraining).toHaveBeenCalledWith(
      {
        name: 'T',
        description: 'D',
        ageGroupTarget: 'U15',
        exercises: [
          { exerciseId: 'lib-1', order: 1, durationMinutes: 10 },
          { exerciseId: 'new-1', order: 2, durationMinutes: 20 },
        ],
      },
      'u1',
    );
  });

  it('says the exercises were kept when only the training failed', async () => {
    vi.mocked(trainingsApi.createTraining).mockRejectedValueOnce(new Error('tx'));
    const created = new Map<string, string>();
    await expect(saveTrainingDraft(training, 'u1', created)).rejects.toMatchObject({ issue: { code: 'trainingFailedKept' } });
    await saveTrainingDraft(training, 'u1', created);
    expect(exercisesApi.createExercise).toHaveBeenCalledTimes(1);
  });
});

describe('new fields', () => {
  it('saves a drafted exercise with its minimum players', async () => {
    vi.mocked(exercisesApi.createExercise).mockResolvedValue('id-9');
    await saveExerciseDrafts([{ ...draft('m', false), minPlayers: 6 }], 'u1', new Map());
    expect(exercisesApi.createExercise).toHaveBeenCalledWith({ name: 'Name m', category: 'game', description: 'd', minPlayers: 6 }, 'u1');
  });

  it('puts targets and suggested players on the training input', () => {
    const input = trainingDraftToInput(
      { name: 'T', description: '', ageGroupTarget: 'U17', steps: [], issues: [], targets: ['reception'], suggestedPlayers: 9 },
      new Map(),
    );
    expect(input).toMatchObject({ targets: ['reception'], suggestedPlayers: 9 });
  });
});
