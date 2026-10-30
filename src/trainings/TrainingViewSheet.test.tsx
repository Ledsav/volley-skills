import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoticeProvider } from '../components/Notice';
import * as exercisesApi from '../exercises/exercisesApi';
import * as shareFile from '../export/shareFile';
import * as exportTrainingPdf from './pdf/exportTrainingPdf';
import type { Training } from '../types/training';
import { TrainingViewSheet } from './TrainingViewSheet';
import { authValue } from '../test/authValue';
import { EMPTY_ONBOARDING } from '../onboarding/onboardingState';

const authMock = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => authMock.value }));

vi.mock('../exercises/exercisesApi');
vi.mock('../export/shareFile');
vi.mock('./pdf/exportTrainingPdf');
vi.mock('../players/playersApi', () => ({
  listPlayers: vi.fn().mockResolvedValue({
    players: [{ id: 'p1', fullName: 'Ilaria Lanzoni', number: 10, positionCategory: 'OH', level: 'Advanced', starting: false, leftClubAt: null }],
    lastDoc: null,
    hasMore: false,
  }),
}));
vi.mock('../teams/teamsApi', () => ({ getTeam: vi.fn().mockResolvedValue({ id: 'u17', name: 'U17' }) }));
vi.mock('../diagrams/diagramsApi', () => ({ listDiagrams: vi.fn().mockResolvedValue([]) }));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../diagrams/DiagramThumbnail', () => ({ DiagramThumbnail: () => null }));

const training = {
  id: 't-1',
  businessId: 'TR-0007',
  name: 'Passing circuit',
  description: 'Focus on platform angle.',
  ageGroupTarget: 'U17',
  exercises: [
    { exerciseId: 'ex-2', order: 2, durationMinutes: 15 },
    { exerciseId: 'ex-1', order: 1, durationMinutes: 10 },
  ],
} as unknown as Training;

describe('TrainingViewSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.value = authValue();
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([
      { id: 'ex-1', name: 'Pepper', description: 'Two players.', category: 'warmup', createdBy: 'x', createdAt: null },
      { id: 'ex-2', name: 'Serve targets', description: 'Aim at zones.', category: 'service', createdBy: 'x', createdAt: null },
    ]);
  });

  it('lists the plan in order with time slots and totals', async () => {
    render(<TrainingViewSheet training={training} onClose={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'TR-0007 · Passing circuit' })).toBeInTheDocument();
    expect(screen.getByText(/2 exercises · 25 min/)).toBeInTheDocument();
    expect(screen.getByText('Focus on platform angle.')).toBeInTheDocument();

    const plan = await screen.findByRole('list', { name: 'Training plan' });
    const items = within(plan).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Pepper');
    expect(items[0]).toHaveTextContent('10 min · min 0–10');
    expect(items[1]).toHaveTextContent('Serve targets');
    expect(items[1]).toHaveTextContent('15 min · min 10–25');
  });

  it('opens an exercise full-screen from the plan, and Start opens the first one', async () => {
    render(<TrainingViewSheet training={training} onClose={vi.fn()} onEdit={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'View exercise 2: Serve targets' }));
    expect(screen.getByRole('dialog', { name: 'Serve targets' })).toBeInTheDocument();
    expect(await screen.findByText('No diagrams for this exercise.')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Serve targets' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('dialog', { name: 'Pepper' })).toBeInTheDocument();
    expect(await screen.findByText('No diagrams for this exercise.')).toBeInTheDocument();
  });

  it('hands off to the editor', async () => {
    const onEdit = vi.fn();
    render(<TrainingViewSheet training={training} onClose={vi.fn()} onEdit={onEdit} />);
    await screen.findByRole('list', { name: 'Training plan' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
  it('shows suggested players and targets only when the training has them', async () => {
    const { unmount } = render(
      <TrainingViewSheet
        training={{ ...training, suggestedPlayers: 12, targets: ['service', 'defense'] }}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText('12 players')).toBeInTheDocument();
    const targets = screen.getByRole('list', { name: 'Targets' });
    expect(within(targets).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Service', 'Defense']);
    await screen.findByRole('list', { name: 'Training plan' });
    unmount();

    render(<TrainingViewSheet training={training} onClose={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.queryByText(/\d+ players/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Targets' })).not.toBeInTheDocument();
    await screen.findByRole('list', { name: 'Training plan' });
  });
  describe('pdf-share tip', () => {
    const update = vi.fn();
    const welcomedAuth = () => authValue({ onboarding: { ...EMPTY_ONBOARDING, welcomed: true }, updateOnboarding: update });
    const pdf = new File(['%PDF'], 'x.pdf', { type: 'application/pdf' });

    it('shows inside the view sheet and ends when a PDF has been built', async () => {
      authMock.value = welcomedAuth();
      vi.mocked(exportTrainingPdf.generateTrainingPdf).mockResolvedValue(pdf);
      render(<NoticeProvider><TrainingViewSheet training={training} onClose={vi.fn()} onEdit={vi.fn()} /></NoticeProvider>);
      expect(screen.getByText('Sharing a PDF')).toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Share PDF' }));
      await screen.findByRole('button', { name: 'Share PDF ready' });
      expect(update).toHaveBeenCalledWith({ kind: 'tip', id: 'pdf-share' });
    });

    it('is absent before the welcome', async () => {
      render(<NoticeProvider><TrainingViewSheet training={training} onClose={vi.fn()} onEdit={vi.fn()} /></NoticeProvider>);
      expect(screen.queryByText('Sharing a PDF')).not.toBeInTheDocument();
    });
  });
  describe('share as PDF', () => {
    const pdf = new File(['%PDF'], 'TR-0007-Passing-circuit.pdf', { type: 'application/pdf' });
    const renderSheet = () =>
      render(
        <NoticeProvider>
          <TrainingViewSheet training={training} onClose={vi.fn()} onEdit={vi.fn()} />
        </NoticeProvider>,
      );

    it('builds the PDF on the first tap, then shares it on the second without rebuilding', async () => {
      let resolve: (f: File) => void = () => {};
      vi.mocked(exportTrainingPdf.generateTrainingPdf).mockReturnValue(new Promise((r) => (resolve = r)));
      vi.mocked(shareFile.shareOrDownload).mockResolvedValue('shared');
      renderSheet();

      fireEvent.click(screen.getByRole('button', { name: 'Share PDF' }));
      expect(await screen.findByRole('button', { name: 'Preparing PDF…' })).toBeDisabled();
      resolve(pdf);
      fireEvent.click(await screen.findByRole('button', { name: 'Share PDF ready' }));
      await waitFor(() => expect(shareFile.shareOrDownload).toHaveBeenCalledWith([pdf], 'Passing circuit'));

      fireEvent.click(screen.getByRole('button', { name: 'Share PDF ready' }));
      await waitFor(() => expect(shareFile.shareOrDownload).toHaveBeenCalledTimes(2));
      expect(exportTrainingPdf.generateTrainingPdf).toHaveBeenCalledTimes(1);
    });

    it('autoBuildPdf starts building once and still needs the Share PDF ready tap', async () => {
      vi.mocked(exportTrainingPdf.generateTrainingPdf).mockResolvedValue(pdf);
      vi.mocked(shareFile.shareOrDownload).mockResolvedValue('shared');
      render(
        <NoticeProvider>
          <TrainingViewSheet training={training} autoBuildPdf onClose={vi.fn()} onEdit={vi.fn()} />
        </NoticeProvider>,
      );
      const ready = await screen.findByRole('button', { name: 'Share PDF ready' });
      expect(exportTrainingPdf.generateTrainingPdf).toHaveBeenCalledTimes(1);
      expect(shareFile.shareOrDownload).not.toHaveBeenCalled();
      fireEvent.click(ready);
      await waitFor(() => expect(shareFile.shareOrDownload).toHaveBeenCalledWith([pdf], 'Passing circuit'));
      expect(exportTrainingPdf.generateTrainingPdf).toHaveBeenCalledTimes(1);
    });

    it('announces when the PDF is being prepared and when it is ready', async () => {
      let resolve: (f: File) => void = () => {};
      vi.mocked(exportTrainingPdf.generateTrainingPdf).mockReturnValue(new Promise((r) => (resolve = r)));
      renderSheet();
      fireEvent.click(screen.getByRole('button', { name: 'Share PDF' }));
      const status = screen.getByTestId('pdf-status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      await waitFor(() => expect(status).toHaveTextContent('Preparing the PDF…'));
      resolve(pdf);
      await waitFor(() => expect(status).toHaveTextContent('PDF ready. Tap Share PDF ready to send it.'));
    });

    it('shows an inline error and resets when the PDF cannot be built', async () => {
      vi.mocked(exportTrainingPdf.generateTrainingPdf).mockRejectedValue(new Error('boom'));
      renderSheet();
      fireEvent.click(screen.getByRole('button', { name: 'Share PDF' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the PDF. Please try again.');
      expect(screen.getByRole('button', { name: 'Share PDF' })).toBeEnabled();
    });

    it('confirms a download fallback, and stays ready after a cancelled share', async () => {
      vi.mocked(exportTrainingPdf.generateTrainingPdf).mockResolvedValue(pdf);
      vi.mocked(shareFile.shareOrDownload).mockResolvedValueOnce('cancelled').mockResolvedValueOnce('downloaded');
      renderSheet();
      fireEvent.click(screen.getByRole('button', { name: 'Share PDF' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Share PDF ready' }));
      await waitFor(() => expect(shareFile.shareOrDownload).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('PDF downloaded')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Share PDF ready' }));
      expect(await screen.findByText('PDF downloaded')).toBeInTheDocument();
    });
  });

  describe('share as PDF for a calendar session', () => {
    it('asks for team notes first, then builds the PDF with them', async () => {
      const pdf = new File(['%PDF'], 'x.pdf', { type: 'application/pdf' });
      vi.mocked(exportTrainingPdf.generateTrainingPdf).mockResolvedValue(pdf);
      render(
        <NoticeProvider>
          <TrainingViewSheet
            training={training}
            teamContext={{ teamId: 'u17', date: '2026-10-24', notes: 'Gym B' }}
            onClose={vi.fn()}
            onEdit={vi.fn()}
          />
        </NoticeProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Share PDF' }));
      fireEvent.change(await screen.findByLabelText('What to look at for Ilaria Lanzoni'), { target: { value: 'Lead the line.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create PDF' }));
      expect(await screen.findByRole('button', { name: 'Share PDF ready' })).toBeInTheDocument();
      expect(exportTrainingPdf.generateTrainingPdf).toHaveBeenCalledWith(training, {
        teamName: 'U17',
        gender: 'mixed',
        date: '2026-10-24',
        general: 'Gym B',
        players: [{ name: 'Ilaria Lanzoni', position: 'Outside', level: 'Advanced', note: 'Lead the line.' }],
      });
      expect(screen.getByRole('button', { name: 'Edit team notes' })).toBeInTheDocument();
    });
  });

  it('reads as a view on phones: Done, no Cancel', () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width: 767px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      render(<TrainingViewSheet training={training} onClose={vi.fn()} onEdit={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    } finally {
      // @ts-expect-error restore jsdom's absence of matchMedia
      delete window.matchMedia;
    }
  });
});
