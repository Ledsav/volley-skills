import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamPage } from './TeamPage';
import * as teamsApi from './teamsApi';
import * as playersApi from '../players/playersApi';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess } from '../test/authValue';
import type { Team } from '../types/team';
import { NoticeProvider } from '../components/Notice';
import { usePageChromeState } from '../layout/PageChrome';
import { WithChrome } from '../test/chromeProbe';

import { EMPTY_ONBOARDING } from '../onboarding/onboardingState';
vi.mock('./teamsApi');
vi.mock('../players/playersApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
// The Stats chunk never arrives: the Suspense fallback stays on screen.
vi.mock('./stats/TeamStatsTab', () => new Promise(() => {}));

const team = { id: 'team-1', name: 'U17 Boys', ageGroup: 'U17', season: '2026', adminEmails: [], createdBy: 'coach-uid', createdAt: null } as unknown as Team;

function Title() {
  return <div data-testid="title">{usePageChromeState().title}</div>;
}

describe('TeamPage Stats fallback', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid' } as never, appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING }, access: clubAdminAccess }));
  });

  it('keeps the toolbar title while the Stats chunk loads', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    render(
      <MemoryRouter initialEntries={['/teams/team-1?tab=stats']}>
        <NoticeProvider>
          <WithChrome>
            <Title />
            <Routes><Route path="/teams/:teamId" element={<TeamPage />} /></Routes>
          </WithChrome>
        </NoticeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Loading team stats…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('title')).toHaveTextContent('U17 Boys'));
  });
});
