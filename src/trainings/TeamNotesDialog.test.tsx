import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as playersApi from '../players/playersApi';
import * as teamsApi from '../teams/teamsApi';
import type { Player } from '../types/player';
import { TeamNotesDialog } from './TeamNotesDialog';

vi.mock('../players/playersApi');
vi.mock('../teams/teamsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const player = (id: string, fullName: string, extra: Partial<Player> = {}) =>
  ({ id, fullName, number: 0, positionCategory: 'TBD', level: null, starting: false, leftClubAt: null, ...extra }) as Player;

describe('TeamNotesDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(teamsApi.getTeam).mockResolvedValue({ id: 'u17', name: 'U17' } as never);
    vi.mocked(playersApi.listPlayers).mockResolvedValue({
      players: [
        player('p1', 'Ilaria Lanzoni', { positionCategory: 'OH', level: 'Advanced', number: 10 }),
        player('p2', 'Olivia SANCHEZ', { level: 'Beginner' }),
        player('p3', 'Gone PLAYER', { leftClubAt: '2026-09-01' }),
      ],
      lastDoc: null,
      hasMore: false,
    });
  });

  const renderDialog = (onConfirm = vi.fn()) => {
    render(
      <TeamNotesDialog teamId="u17" date="2026-10-24" initialGeneral="Session note" onCancel={vi.fn()} onConfirm={onConfirm} />,
    );
    return onConfirm;
  };

  it('lists the current roster, all expected by default, without players who left', async () => {
    renderDialog();
    const list = await screen.findByRole('list', { name: 'Expected players' });
    expect(within(list).getByRole('checkbox', { name: /Ilaria Lanzoni/ })).toBeChecked();
    expect(within(list).getByRole('checkbox', { name: /Olivia SANCHEZ/ })).toBeChecked();
    expect(within(list).queryByText('Gone PLAYER')).not.toBeInTheDocument();
    expect(screen.getByLabelText('General notes')).toHaveValue('Session note');
  });

  it('confirms with the expected players, their levels and notes', async () => {
    const onConfirm = renderDialog();
    await screen.findByRole('list', { name: 'Expected players' });
    fireEvent.change(screen.getByLabelText('What to look at for Ilaria Lanzoni'), { target: { value: 'Lead the line.' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Olivia SANCHEZ/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create PDF' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0][0]).toEqual({
      teamName: 'U17',
      date: '2026-10-24',
      general: 'Session note',
      players: [{ name: 'Ilaria Lanzoni', position: 'Outside', level: 'Advanced', note: 'Lead the line.' }],
    });
  });

  it('shows an inline error when the roster cannot be loaded', async () => {
    vi.mocked(playersApi.listPlayers).mockRejectedValue(new Error('offline'));
    renderDialog();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the team. Please try again.');
  });
});
