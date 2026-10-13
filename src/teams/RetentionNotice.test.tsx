import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RetentionNotice } from './RetentionNotice';
import * as playersApi from '../players/playersApi';
import type { Player } from '../types/player';

vi.mock('../players/playersApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const old = { id: 'p1', fullName: 'Old Player', leftClubAt: '2025-06-01' } as Player;

function renderNotice(onDeleted = vi.fn()) {
  render(
    <MemoryRouter>
      <RetentionNotice teamId="team-1" onDeleted={onDeleted} />
    </MemoryRouter>
  );
  return onDeleted;
}

describe('RetentionNotice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when no one is due', async () => {
    vi.mocked(playersApi.listPlayersDueForDeletion).mockResolvedValue([]);
    renderNotice();
    await waitFor(() => expect(playersApi.listPlayersDueForDeletion).toHaveBeenCalled());
    expect(screen.queryByText(/due for deletion/)).not.toBeInTheDocument();
  });

  it('queries with a cutoff twelve months back', async () => {
    vi.mocked(playersApi.listPlayersDueForDeletion).mockResolvedValue([]);
    renderNotice();
    await waitFor(() => expect(playersApi.listPlayersDueForDeletion).toHaveBeenCalled());
    const [, cutoff] = vi.mocked(playersApi.listPlayersDueForDeletion).mock.calls[0];
    const expected = new Date();
    expected.setUTCFullYear(expected.getUTCFullYear() - 1);
    expect(cutoff.slice(0, 4)).toBe(String(expected.getUTCFullYear()));
  });

  it('lists due players and deletes one after confirmation', async () => {
    vi.mocked(playersApi.listPlayersDueForDeletion).mockResolvedValue([old]);
    vi.mocked(playersApi.deletePlayer).mockResolvedValue(undefined);
    const onDeleted = renderNotice();

    expect(await screen.findByText('1 player is due for deletion')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(playersApi.deletePlayer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete player' }));

    await waitFor(() => expect(playersApi.deletePlayer).toHaveBeenCalledWith('team-1', 'p1'));
    await waitFor(() => expect(screen.queryByText('Old Player')).not.toBeInTheDocument());
    expect(onDeleted).toHaveBeenCalled();
  });
});
