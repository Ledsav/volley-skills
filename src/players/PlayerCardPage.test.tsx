import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PlayerCardPage } from './PlayerCardPage';
import * as playersApi from './playersApi';
import * as teamsApi from '../teams/teamsApi';
import * as physicalTestsApi from './physicalTestsApi';
import type { Player } from '../types/player';

vi.mock('./playersApi');
vi.mock('../teams/teamsApi');
vi.mock('./physicalTestsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const basePlayer: Player = {
  id: 'player-1',
  number: 7,
  fullName: 'Test Player',
  dob: '2012-01-01',
  nationality: 'BEL',
  licenseNumber: 'J-000001',
  position: 'OH',
  playerPhone: '',
  guardians: [],
  viewerEmails: ['viewer@example.com'],
  teamName: 'U17',
  ageGroup: 'U17',
  season: '2026-27',
  skills: {
    serve: { score: null, notes: '', priority: false },
    attack: { score: null, notes: '', priority: false },
    set: { score: null, notes: '', priority: false },
    defence: { score: null, notes: '', priority: false },
    reception: { score: null, notes: '', priority: false },
    jump: { score: null, notes: '', priority: false },
    speed: { score: null, notes: '', priority: false },
    iq: { score: null, notes: '', priority: false },
  },
  avgScore: null,
  level: null,
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  consent: { given: true, date: '2026-09-07', confirmedBy: 'coach@example.com' },
  createdBy: 'coach-uid',
  createdAt: null,
  updatedAt: null,
};

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

  it('renders the player card in read-only mode for a linked viewer whose team read is denied', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/teams/team-1/players/player-1']}>
        <Routes>
          <Route path="/teams/:teamId/players/:playerId" element={<PlayerCardPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Test Player')).toBeInTheDocument();
    expect(screen.queryByText("You don't have access to this player.")).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });
});
