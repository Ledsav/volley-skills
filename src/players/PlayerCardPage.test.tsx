import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PlayerCardPage } from './PlayerCardPage';
import * as playersApi from './playersApi';
import * as teamsApi from '../teams/teamsApi';

vi.mock('./playersApi');
vi.mock('../teams/teamsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

describe('PlayerCardPage', () => {
  it('shows an access message instead of loading forever when the read is rejected', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/teams/team-1/players/player-1']}>
        <Routes>
          <Route path="/teams/:teamId/players/:playerId" element={<PlayerCardPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent("You don't have access to this player.");
    expect(screen.queryByText('Loading player...')).not.toBeInTheDocument();
  });
});
