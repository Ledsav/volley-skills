import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../../types/player';
import { DvwImportDialog } from './DvwImportDialog';
import * as api from './dvwImportApi';
import * as matchesApi from '../matchesApi';

vi.mock('./dvwImportApi');
vi.mock('../matchesApi');
// jsdom's ArrayBuffer is not the realm webcrypto expects; hashing has its own node-environment test.
vi.mock('./sha256', () => ({ sha256OfBytes: async () => 'hash' }));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {} }));
const notify = vi.fn();
vi.mock('../../components/Notice', () => ({ useNotify: () => notify }));
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { uid: 'u1' }, club: { name: 'Volley Club Test' } }),
}));

const FIXTURES = join(process.cwd(), 'src', 'matches', 'dvw', 'fixtures');
const fixtureText = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

const player = (n: number): Player =>
  ({ id: `p${n}`, number: n, fullName: `App ${n}`, positionCategory: 'U', starting: false }) as Player;
const PLAYERS = Array.from({ length: 16 }, (_, i) => player(i + 1));

function fileOf(text: string, name = 'match.dvw', size?: number): File {
  const f = new File([text], name);
  if (size) Object.defineProperty(f, 'size', { value: size });
  return f;
}

function pick(file: File) {
  fireEvent.change(screen.getByLabelText(/dvw file/i), { target: { files: [file] } });
}

function renderDialog() {
  const onImported = vi.fn();
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <DvwImportDialog teamId="t1" teamName="Volley Club Test" onClose={onClose} onImported={onImported} />
    </MemoryRouter>,
  );
  return { onImported, onClose };
}

async function toReview(name = 'three-sets-home.dvw') {
  const r = renderDialog();
  pick(fileOf(fixtureText(name), name));
  await screen.findByText(/which team is us/i);
  return r;
}

describe('DvwImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(matchesApi.loadTeamRoster).mockResolvedValue(PLAYERS);
    vi.mocked(api.findImportedMatch).mockResolvedValue(null);
    vi.mocked(api.startImport).mockReturnValue({
      matchId: 'm1', eventIds: [], nextBatch: 0, matchWritten: false, uid: 'u1',
      meta: { fileName: 'x', fileSha256: 'h', generator: 'g', warnings: 0 },
    });
    vi.mocked(api.runImport).mockResolvedValue(undefined);
    vi.mocked(api.discardImport).mockResolvedValue(undefined);
  });

  it('shows the help text and the footnote on the file step', () => {
    renderDialog();
    expect(screen.getByText(/also works with click&scout and volleystation \.dvw exports\./i)).toBeInTheDocument();
    expect(
      screen.getByText('Not affiliated with Data Project or Genius Sports. DataVolley is a trademark of its owner.'),
    ).toBeInTheDocument();
  });

  it('shows the parse error inline for a non-DataVolley file', async () => {
    renderDialog();
    pick(fileOf('hello world', 'notes.dvw'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/which team is us/i)).not.toBeInTheDocument();
  });

  it('resets the file picker after an error so the same file can be picked again', async () => {
    renderDialog();
    const before = screen.getByLabelText(/dvw file/i);
    pick(fileOf('hello world', 'notes.dvw'));
    await screen.findByRole('alert');
    expect(screen.getByLabelText(/dvw file/i)).not.toBe(before);
    expect(screen.getByLabelText(/dvw file/i)).toHaveValue('');
  });

  it('refuses a file over 2 MB', async () => {
    renderDialog();
    pick(fileOf(fixtureText('three-sets-home.dvw'), 'big.dvw', 2 * 1024 * 1024 + 1));
    expect(await screen.findByRole('alert')).toHaveTextContent('This file is larger than 2 MB.');
  });

  it('preselects our side by name and remaps the roster when flipped', async () => {
    await toReview();
    const home = screen.getByRole('radio', { name: /volley club test/i });
    const away = screen.getByRole('radio', { name: /rivali uno/i });
    expect(home).toBeChecked();
    expect(screen.getByLabelText(/opponent/i)).toHaveValue('Rivali Uno');
    expect(screen.getByLabelText(/map #7 /i)).toHaveValue('p7');
    expect(screen.queryByLabelText(/map #10 /i)).not.toBeInTheDocument();
    fireEvent.click(away);
    expect(away).toBeChecked();
    expect(screen.getByLabelText(/opponent/i)).toHaveValue('Volley Club Test');
    expect(screen.getByLabelText(/map #10 /i)).toHaveValue('p10');
    expect(screen.queryByLabelText(/map #8 /i)).not.toBeInTheDocument();
  });

  it('blocks import while a starter is skipped', async () => {
    await toReview();
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/map #7 /i), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    expect(within(screen.getByTestId('blocking-issues')).getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('blocks import when the date is empty', async () => {
    await toReview();
    fireEvent.change(screen.getByLabelText(/^date/i), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    expect(screen.getByTestId('blocking-issues')).toHaveTextContent('Pick a date.');
  });

  it('warns about a duplicate with a link to the existing match', async () => {
    vi.mocked(api.findImportedMatch).mockResolvedValue({ id: 'old1', date: '2026-10-18', opponent: 'Rivali Uno' });
    await toReview();
    expect(screen.getByRole('link', { name: /existing match/i })).toHaveAttribute('href', '/teams/t1/matches/old1');
  });

  it('requires the score confirmation when replayed and file set scores differ', async () => {
    const text = fixtureText('three-sets-home.dvw').replace('6-8;16-11;21-20;25-20;', '6-8;16-11;21-20;25-18;');
    const r = renderDialog();
    pick(fileOf(text, 'mismatch.dvw'));
    await screen.findByText(/which team is us/i);
    expect(r.onClose).not.toHaveBeenCalled();
    const confirm = screen.getByLabelText('I checked the scores');
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    fireEvent.click(confirm);
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('never starts an import while the plan is blocked', async () => {
    await toReview();
    fireEvent.change(screen.getByLabelText(/map #7 /i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    expect(api.startImport).not.toHaveBeenCalled();
    expect(api.runImport).not.toHaveBeenCalled();
  });

  it('imports the edited match fields and keeps them when the side is flipped', async () => {
    await toReview();
    fireEvent.change(screen.getByLabelText(/^competition/i), { target: { value: 'cup' } });
    fireEvent.change(screen.getByLabelText(/^format/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/^date/i), { target: { value: '2026-11-02' } });
    fireEvent.click(screen.getByRole('radio', { name: /rivali uno/i }));
    expect(screen.getByLabelText(/^competition/i)).toHaveValue('cup');
    expect(screen.getByLabelText(/^format/i)).toHaveValue('3');
    expect(screen.getByLabelText(/^date/i)).toHaveValue('2026-11-02');
    expect(screen.getByLabelText(/opponent/i)).toHaveValue('Volley Club Test');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(api.startImport).toHaveBeenCalled());
    const plan = vi.mocked(api.startImport).mock.calls[0][1];
    expect(plan.setup).toMatchObject({ competition: 'cup', date: '2026-11-02', opponent: 'Volley Club Test' });
    expect(plan.setup.format.bestOf).toBe(3);
    expect(vi.mocked(api.runImport).mock.calls[0][1]).toBe(plan);
  });

  it('discards the partial match when a failed import is closed', async () => {
    vi.mocked(api.runImport).mockRejectedValueOnce(new Error('offline'));
    const { onClose } = await toReview();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByRole('button', { name: 'Retry' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    const discards = await screen.findAllByRole('button', { name: 'Discard' });
    fireEvent.click(discards[discards.length - 1]);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.discardImport).toHaveBeenCalledWith('t1', 'm1');
  });

  it('shows a discard error and stays open', async () => {
    vi.mocked(api.runImport).mockRejectedValueOnce(new Error('offline'));
    vi.mocked(api.discardImport).mockRejectedValueOnce(new Error('offline'));
    const { onClose } = await toReview();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows parse warnings in the checks and counts them in the import', async () => {
    const text = fixtureText('three-sets-home.dvw').replace('*P11>LUp;;;;;;;;1;', '*P11>LUp;;;;;;;;;');
    renderDialog();
    pick(fileOf(text, 'no-set.dvw'));
    await screen.findByText(/which team is us/i);
    expect(screen.getByTestId('checks')).toHaveTextContent(
      'Set 1: 1 scout line has a missing or different set number (line 53); the set markers were used.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(api.startImport).toHaveBeenCalled());
    // One parse warning plus the plan's one warning (the serve graded "!").
    expect(vi.mocked(api.startImport).mock.calls[0][2].warnings).toBe(2);
  });

  it('labels a player with special role L as Libero whatever the role code', async () => {
    const text = fixtureText('three-sets-home.dvw').replace('T007;Gallard;Hugo;;L;1;', 'T007;Gallard;Hugo;;L;4;');
    renderDialog();
    pick(fileOf(text, 'libero.dvw'));
    await screen.findByText(/which team is us/i);
    expect(screen.getByLabelText(/map #4 /i).closest('li')).toHaveTextContent('Libero');
  });

  it('blocks import when two file players are mapped to the same app player', async () => {
    await toReview();
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/map #9 /i), { target: { value: 'p7' } });
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    expect(screen.getByTestId('blocking-issues')).toHaveTextContent(
      'Two file players are mapped to the same app player (#7 and #9).',
    );
  });

  it('shows the checks: corrections and sets', async () => {
    await toReview();
    expect(screen.getByTestId('checks')).toHaveTextContent(/score corrections/i);
    expect(screen.getByTestId('checks')).toHaveTextContent(/set 1/i);
  });

  it('retries a failed import and opens the match when done', async () => {
    vi.mocked(api.runImport).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const { onImported } = await toReview();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(onImported).toHaveBeenCalledWith('m1'));
    expect(api.runImport).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.runImport).mock.calls[0][2]).toBe(vi.mocked(api.runImport).mock.calls[1][2]);
    expect(api.startImport).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('Match imported.');
  });

  it('discards a failed import and closes', async () => {
    vi.mocked(api.runImport).mockRejectedValueOnce(new Error('offline'));
    const { onClose } = await toReview();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.discardImport).toHaveBeenCalledWith('t1', 'm1');
  });
});
