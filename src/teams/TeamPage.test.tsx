import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TeamPage } from './TeamPage';
import * as teamsApi from './teamsApi';

vi.mock('./teamsApi');
vi.mock('../players/playersApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

describe('TeamPage', () => {
  it('shows an access message instead of loading forever when the read is rejected', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockRejectedValue({ code: 'permission-denied' });

    render(
      <MemoryRouter initialEntries={['/teams/team-1']}>
        <Routes>
          <Route path="/teams/:teamId" element={<TeamPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent("You don't have access to this team.");
    expect(screen.queryByText('Loading team...')).not.toBeInTheDocument();
  });
});
