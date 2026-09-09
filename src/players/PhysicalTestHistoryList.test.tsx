import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PhysicalTestHistoryList } from './PhysicalTestHistoryList';
import * as physicalTestsApi from './physicalTestsApi';
import type { PhysicalTest } from '../types/physicalTest';

vi.mock('./physicalTestsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function makeEntry(id: string, date: string): PhysicalTest {
  return { id, testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34, date, notes: '', recordedBy: 'coach-uid', createdAt: null };
}

describe('PhysicalTestHistoryList', () => {
  beforeEach(() => {
    vi.spyOn(physicalTestsApi, 'listSeriesByType').mockResolvedValue([]);
  });

  it('shows "No entries yet." when history is empty', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({ tests: [], lastDoc: null });

    render(<PhysicalTestHistoryList teamId="team-1" playerId="player-1" testType="cmj" isAdmin={false} onClose={vi.fn()} />);

    expect(await screen.findByText('No entries yet.')).toBeInTheDocument();
  });

  it('loads the next page when "Load more" is clicked', async () => {
    const lastDocStub = { id: 'test-1' } as never;
    vi.spyOn(physicalTestsApi, 'listHistoryByType')
      .mockResolvedValueOnce({ tests: [makeEntry('test-1', '2026-08-01')], lastDoc: lastDocStub })
      .mockResolvedValueOnce({ tests: [makeEntry('test-2', '2026-09-01')], lastDoc: null });

    render(<PhysicalTestHistoryList teamId="team-1" playerId="player-1" testType="cmj" isAdmin={false} onClose={vi.fn()} />);

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

    render(<PhysicalTestHistoryList teamId="team-1" playerId="player-1" testType="cmj" isAdmin={false} onClose={vi.fn()} />);

    const row = await screen.findByText(/2026-08-01/);
    expect(screen.queryByText('Attempts')).not.toBeInTheDocument();

    fireEvent.click(row);

    expect(screen.getByText('Attempts')).toBeInTheDocument();
    expect(screen.getByText('30, 34, 32 cm')).toBeInTheDocument();
    expect(screen.getByText('Felt strong today')).toBeInTheDocument();
  });

  it('does not show a delete button for non-admins', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({ tests: [makeEntry('test-1', '2026-08-01')], lastDoc: null });

    render(<PhysicalTestHistoryList teamId="team-1" playerId="player-1" testType="cmj" isAdmin={false} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByText(/2026-08-01/));

    expect(screen.queryByText('Delete entry')).not.toBeInTheDocument();
  });

  it('deletes an entry after admin confirms, then refetches the list and chart', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType')
      .mockResolvedValueOnce({ tests: [makeEntry('test-1', '2026-08-01')], lastDoc: null })
      .mockResolvedValueOnce({ tests: [], lastDoc: null });
    vi.spyOn(physicalTestsApi, 'deletePhysicalTest').mockResolvedValue(undefined);

    render(<PhysicalTestHistoryList teamId="team-1" playerId="player-1" testType="cmj" isAdmin onClose={vi.fn()} />);

    fireEvent.click(await screen.findByText(/2026-08-01/));
    fireEvent.click(screen.getByText('Delete entry'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => expect(physicalTestsApi.deletePhysicalTest).toHaveBeenCalledWith('team-1', 'player-1', 'test-1'));
    await waitFor(() => expect(screen.getByText('No entries yet.')).toBeInTheDocument());
  });
});
