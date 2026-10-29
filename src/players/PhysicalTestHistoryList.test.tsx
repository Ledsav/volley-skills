import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoticeProvider, UNDO_MS } from '../components/Notice';
import { I18nProvider } from '../i18n/I18nProvider';
import type { PhysicalTest } from '../types/physicalTest';
import { PhysicalTestHistoryList } from './PhysicalTestHistoryList';
import * as physicalTestsApi from './physicalTestsApi';

vi.mock('./physicalTestsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function makeEntry(id: string, date: string): PhysicalTest {
  return { id, testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34, date, notes: '', recordedBy: 'coach-uid', createdAt: null };
}

function renderList(over: { isAdmin?: boolean; onClose?: () => void } = {}) {
  return render(
    <I18nProvider>
      <NoticeProvider>
        <PhysicalTestHistoryList teamId="team-1" playerId="player-1" testType="cmj" isAdmin={over.isAdmin ?? true} onClose={over.onClose ?? vi.fn()} />
      </NoticeProvider>
    </I18nProvider>,
  );
}

describe('PhysicalTestHistoryList', () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(physicalTestsApi, 'listSeriesByType').mockResolvedValue([]);
  });

  it('shows "No entries yet." when history is empty', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({ tests: [], lastDoc: null });

    renderList({ isAdmin: false });

    expect(await screen.findByText('No entries yet.')).toBeInTheDocument();
  });

  it('loads the next page when "Load more" is clicked', async () => {
    const lastDocStub = { id: 'test-1' } as never;
    vi.spyOn(physicalTestsApi, 'listHistoryByType')
      .mockResolvedValueOnce({ tests: [makeEntry('test-1', '2026-08-01')], lastDoc: lastDocStub })
      .mockResolvedValueOnce({ tests: [makeEntry('test-2', '2026-09-01')], lastDoc: null });

    renderList({ isAdmin: false });

    await screen.findByText(/2026-08-01/);
    fireEvent.click(screen.getByText('Load more'));

    await waitFor(() => expect(screen.getByText(/2026-09-01/)).toBeInTheDocument());
    expect(physicalTestsApi.listHistoryByType).toHaveBeenCalledWith('team-1', 'player-1', 'cmj', lastDocStub);
  });

  it('expands a row to show every stored measurement and notes', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({
      tests: [{ ...makeEntry('test-1', '2026-08-01'), notes: 'Felt strong today' }],
      lastDoc: null,
    });

    renderList({ isAdmin: false });

    const row = await screen.findByText(/2026-08-01/);
    expect(screen.queryByText('Attempts')).not.toBeInTheDocument();

    fireEvent.click(row);

    expect(screen.getByText('Attempts')).toBeInTheDocument();
    expect(screen.getByText('30, 34, 32 cm')).toBeInTheDocument();
    expect(screen.getByText('Felt strong today')).toBeInTheDocument();
  });

  it('does not show a delete button for non-admins', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({ tests: [makeEntry('test-1', '2026-08-01')], lastDoc: null });

    renderList({ isAdmin: false });

    fireEvent.click(await screen.findByText(/2026-08-01/));

    expect(screen.queryByText('Delete entry')).not.toBeInTheDocument();
  });

  it('is a modal sheet: Escape closes it', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({ tests: [], lastDoc: null });
    const onClose = vi.fn();

    renderList({ onClose });

    expect(await screen.findByRole('dialog', { name: 'Countermovement Jump history' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('delete is an undo: the row leaves at once and the delete runs when the notice expires', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType')
      .mockResolvedValueOnce({ tests: [makeEntry('test-1', '2026-08-01')], lastDoc: null })
      .mockResolvedValueOnce({ tests: [], lastDoc: null });
    const del = vi.spyOn(physicalTestsApi, 'deletePhysicalTest').mockResolvedValue(undefined);

    renderList();

    fireEvent.click(await screen.findByText(/2026-08-01/));
    fireEvent.click(screen.getByText('Delete entry'));
    expect(screen.queryByText(/2026-08-01 —/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_MS);
    });

    expect(del).toHaveBeenCalledWith('team-1', 'player-1', 'test-1');
    await waitFor(() => expect(screen.getByText('No entries yet.')).toBeInTheDocument());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('a failed refresh after a successful delete does not report a failed delete', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType')
      .mockResolvedValueOnce({ tests: [makeEntry('test-1', '2026-08-01')], lastDoc: null })
      .mockRejectedValueOnce(new Error('offline'));
    const del = vi.spyOn(physicalTestsApi, 'deletePhysicalTest').mockResolvedValue(undefined);

    renderList();

    fireEvent.click(await screen.findByText(/2026-08-01/));
    fireEvent.click(screen.getByText('Delete entry'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_MS);
    });

    expect(del).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/2026-08-01 —/)).not.toBeInTheDocument();
  });

  it('Undo restores the row and never deletes', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({ tests: [makeEntry('test-1', '2026-08-01')], lastDoc: null });
    const del = vi.spyOn(physicalTestsApi, 'deletePhysicalTest').mockResolvedValue(undefined);

    renderList();

    fireEvent.click(await screen.findByText(/2026-08-01/));
    fireEvent.click(screen.getByText('Delete entry'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.getByText(/2026-08-01/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_MS * 2);
    });
    expect(del).not.toHaveBeenCalled();
  });

  it('a failed delete brings the row back with the error', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({ tests: [makeEntry('test-1', '2026-08-01')], lastDoc: null });
    vi.spyOn(physicalTestsApi, 'deletePhysicalTest').mockRejectedValue(new Error('denied'));

    renderList();

    fireEvent.click(await screen.findByText(/2026-08-01/));
    fireEvent.click(screen.getByText('Delete entry'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_MS);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete this entry. Please try again.');
    expect(screen.getByText(/2026-08-01/)).toBeInTheDocument();
  });

  it('right-click on a row offers Delete entry to an admin', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({ tests: [makeEntry('test-1', '2026-08-01')], lastDoc: null });

    renderList();

    fireEvent.contextMenu(await screen.findByText(/2026-08-01/));

    const menu = await screen.findByRole('menu', { name: 'Actions for the entry from 2026-08-01' });
    expect(within(menu).getByRole('menuitem', { name: /Delete entry/ })).toBeInTheDocument();
  });

  it("a viewer's history rows have no context menu", async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({ tests: [makeEntry('test-1', '2026-08-01')], lastDoc: null });

    renderList({ isAdmin: false });

    fireEvent.contextMenu(await screen.findByText(/2026-08-01/));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
