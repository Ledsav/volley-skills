import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as diagramsApi from '../../diagrams/diagramsApi';
import * as exercisesApi from '../../exercises/exercisesApi';
import type { Training } from '../../types/training';
import { generateTrainingPdf } from './exportTrainingPdf';

vi.mock('../../exercises/exercisesApi');
vi.mock('../../diagrams/diagramsApi');
vi.mock('../../firebase/config', () => ({ auth: {}, db: {} }));

const { createPdf, addVirtualFileSystem, setUrlAccessPolicy } = vi.hoisted(() => ({
  createPdf: vi.fn(),
  addVirtualFileSystem: vi.fn(),
  setUrlAccessPolicy: vi.fn(),
}));
vi.mock('pdfmake/build/pdfmake', () => ({ default: { createPdf, addVirtualFileSystem, setUrlAccessPolicy } }));
vi.mock('pdfmake/build/vfs_fonts', () => ({ default: { 'Roboto-Regular.ttf': 'x' } }));

const training = {
  id: 't-1',
  businessId: 'TR-0007',
  name: 'Serve day',
  description: '',
  ageGroupTarget: '',
  exercises: [
    { exerciseId: 'a', order: 1, durationMinutes: 10 },
    { exerciseId: 'gone', order: 2, durationMinutes: 5 },
    { exerciseId: 'a', order: 3, durationMinutes: 5 },
  ],
  exerciseIds: ['a', 'gone', 'a'],
  createdBy: 'x',
  createdAt: null,
} as Training;

describe('generateTrainingPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([
      { id: 'a', name: 'Float serve', description: '', category: 'service', createdBy: 'x', createdAt: null },
    ]);
    vi.mocked(diagramsApi.listDiagrams).mockResolvedValue([]);
    createPdf.mockReturnValue({ getBlob: () => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' })) });
  });

  it('reads each exercise once, diagrams only for exercises that exist, and returns a named PDF file', async () => {
    const file = await generateTrainingPdf(training);
    expect(exercisesApi.getExercisesByIds).toHaveBeenCalledWith(['a', 'gone']);
    expect(diagramsApi.listDiagrams).toHaveBeenCalledTimes(1);
    expect(diagramsApi.listDiagrams).toHaveBeenCalledWith('a');
    expect(addVirtualFileSystem).toHaveBeenCalled();
    expect(createPdf).toHaveBeenCalledTimes(1);
    expect(file.name).toBe('TR-0007-Serve-day.pdf');
    expect(file.type).toBe('application/pdf');
  });

  it('never lets pdfmake fetch anything from a URL', async () => {
    await generateTrainingPdf(training);
    const policy = setUrlAccessPolicy.mock.calls[0][0] as (url: string) => boolean;
    expect(policy('https://example.com/x.png')).toBe(false);
  });

  it('includes team notes and dates the file when built for a calendar session', async () => {
    const file = await generateTrainingPdf(training, {
      teamName: 'U17',
      date: '2026-10-24',
      general: '',
      players: [{ name: 'Ilaria Lanzoni', position: 'Outside hitter', level: 'Advanced', note: 'Lead the line.' }],
    });
    expect(JSON.stringify(createPdf.mock.calls[0][0].content)).toContain('Lead the line.');
    expect(file.name).toBe('TR-0007-Serve-day-2026-10-24.pdf');
  });
});
