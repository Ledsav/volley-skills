import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from '../home/HomePage';
import { TeamPage } from '../teams/TeamPage';
import { PlayerCardPage } from '../players/PlayerCardPage';
import { MatchPage } from '../matches/MatchPage';
import { TrainingBuilderDialog } from '../trainings/TrainingBuilderDialog';
import { NoticeProvider } from '../components/Notice';
import { WithChrome } from '../test/chromeProbe';
import { I18nProvider } from './I18nProvider';
import { en as enCat } from './en';
import { it as itCat } from './it';
import * as teamsApi from '../teams/teamsApi';
import * as playersApi from '../players/playersApi';
import * as calendarApi from '../calendar/calendarApi';
import * as matchesApi from '../matches/matchesApi';
import * as physicalTestsApi from '../players/physicalTestsApi';
import * as exercisesApi from '../exercises/exercisesApi';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess } from '../test/authValue';
import { buildReportData } from '../matches/report/reportData';
import { replay } from '../matches/scoutEngine';
import { DEFAULT_FORMAT, type Match } from '../types/match';
import type { Player } from '../types/player';
import type { Team } from '../types/team';

vi.mock('../teams/teamsApi');
vi.mock('../players/playersApi');
vi.mock('../players/physicalTestsApi');
vi.mock('../players/playerFootprintApi');
vi.mock('../calendar/calendarApi');
vi.mock('../matches/matchesApi');
vi.mock('../exercises/exercisesApi');
vi.mock('../trainings/trainingsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../diagrams/diagramsApi', () => ({ listDiagrams: vi.fn().mockResolvedValue([]) }));
vi.mock('../diagrams/DiagramThumbnail', () => ({ DiagramThumbnail: () => <div /> }));
vi.mock('./locales', async (orig) => ({ ...(await orig<typeof import('./locales')>()), ITALIAN_ENABLED: true }));

const team: Team = {
  id: 't1', name: 'U17 Femminile', ageGroup: 'U17', season: '2026-27', description: '', notes: '', gender: 'women',
  adminEmails: ['coach@example.com'], developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' }, createdBy: 'u1', createdAt: null,
};
const skills = Object.fromEntries(
  ['serve', 'attack', 'block', 'set', 'defence', 'reception', 'jump', 'speed', 'iq'].map((k) => [k, { score: 6, notes: '', priority: false }]),
);
const player = {
  id: 'p1', number: 7, fullName: 'Giulia Rossi', dob: '2012-01-01', nationality: 'ITA', licenseNumber: 'J-1', positionCategory: 'OH', shirtSize: '',
  starting: true, playerPhone: '', guardians: [], viewerEmails: [], teamName: 'U17', ageGroup: 'U17', season: '2026-27', skills, avgScore: 6, level: 'Advanced',
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  consent: { given: true, date: '2026-09-07', confirmedBy: 'coach@example.com' }, createdBy: 'u1', createdAt: null, updatedAt: null,
} as unknown as Player;
const live: Match = {
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT, roster: [], liberos: [],
  status: 'live', result: { setsUs: 1, setsThem: 0, sets: [] }, summary: null, usageContribution: null, activeDevice: null, createdBy: 'u1', createdAt: null, updatedAt: null,
};

function expectItalianAndClean(strings: string[]) {
  const text = document.body.textContent ?? '';
  for (const s of strings) expect(text, `missing Italian text "${s}"`).toContain(s);
  expect(text).not.toContain('undefined');
}

function expectNoEnglish(strings: string[]) {
  const text = document.body.textContent ?? '';
  for (const s of strings) expect(text, `English text "${s}" leaked into the Italian screen`).not.toContain(s);
}

describe('Italian smoke: main screens render Italian and never print "undefined"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('vcb.locale', 'it');
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { uid: 'u1', email: 'coach@example.com' } as never,
        appUser: { uid: 'u1', email: 'coach@example.com' },
        access: clubAdminAccess,
      }),
    );
    vi.mocked(teamsApi.listMyTeams).mockResolvedValue({ teams: [team], lastDoc: null, hasMore: false });
    vi.mocked(teamsApi.listClubTeams).mockResolvedValue({ teams: [team], lastDoc: null, hasMore: false });
    vi.mocked(teamsApi.getTeamSummary).mockResolvedValue({ players: 0, avgScore: null });
    vi.mocked(teamsApi.getTeam).mockResolvedValue(team);
    vi.mocked(playersApi.listPlayers).mockResolvedValue({ players: [player], lastDoc: null, hasMore: false });
    vi.mocked(playersApi.getPlayer).mockResolvedValue(player);
    vi.mocked(playersApi.listPlayersDueForDeletion).mockResolvedValue([]);
    vi.mocked(physicalTestsApi.loadLatestTests).mockResolvedValue({});
    vi.mocked(calendarApi.listCalendarSessions).mockResolvedValue([]);
    vi.mocked(matchesApi.listMatches).mockResolvedValue({ matches: [], lastDoc: null, hasMore: false });
    vi.mocked(matchesApi.listMatchesInRange).mockResolvedValue([live]);
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([]);
    vi.mocked(matchesApi.getMatch).mockResolvedValue(live);
    vi.mocked(matchesApi.subscribeEvents).mockImplementation((_t, _m, onChange) => {
      onChange([], 0);
      return () => undefined;
    });
    vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [], lastDoc: null, hasMore: false });
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([]);
  });

  it('Home', async () => {
    render(<MemoryRouter><I18nProvider><HomePage /></I18nProvider></MemoryRouter>);
    await screen.findByRole('link', { name: new RegExp(itCat.home.resumeScouting) });
    expectItalianAndClean([itCat.home.title, itCat.home.resumeScouting]);
    expectNoEnglish([enCat.home.resumeScouting]);
  });

  it('a team page', async () => {
    render(
      <MemoryRouter initialEntries={['/teams/t1']}>
        <NoticeProvider><I18nProvider>
          <Routes><Route path="/teams/:teamId" element={<TeamPage />} /></Routes>
        </I18nProvider></NoticeProvider>
      </MemoryRouter>,
    );
    const tabs = itCat.teams.page.tabs;
    await screen.findByRole('tab', { name: tabs.matches });
    expectItalianAndClean([tabs.roster, tabs.calendar, tabs.matches, tabs.stats, tabs.settings]);
    expectNoEnglish([enCat.teams.page.tabs.settings, enCat.teams.page.tabs.roster]);
  });

  it('a player card', async () => {
    render(
      <MemoryRouter initialEntries={['/teams/t1/players/p1']}>
        <NoticeProvider><I18nProvider>
          <Routes><Route path="/teams/:teamId/players/:playerId" element={<PlayerCardPage />} /></Routes>
        </I18nProvider></NoticeProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('tablist', { name: itCat.players.card.sectionsLabel });
    const k = itCat.players.kpi;
    expectItalianAndClean([k.skillsRated, k.focusAreas, k.openObjectives, k.lastPhysicalTest, itCat.players.card.sections.skills]);
    expectNoEnglish([enCat.players.kpi.focusAreas, enCat.players.kpi.openObjectives]);
  });

  it('a match report', async () => {
    const m = { ...live, status: 'finished' as const };
    const stats = buildReportData(replay(m, [])).all;
    const report = { setsWon: { us: 3, them: 1 }, setScores: [{ us: 25, them: 20 }], sets: [1], all: stats, bySet: { 1: stats } };
    vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...m, report });
    render(
      <MemoryRouter initialEntries={['/teams/t1/matches/m1']}>
        <I18nProvider>
          <WithChrome>
            <Routes><Route path="/teams/:teamId/matches/:matchId" element={<MatchPage />} /></Routes>
          </WithChrome>
        </I18nProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: itCat.matches.page.reopen });
    expectItalianAndClean([itCat.matches.page.reopen, itCat.matches.page.print, '3–1']);
    expectNoEnglish([enCat.matches.page.reopen, enCat.matches.page.print]);
  });

  it('the training builder', async () => {
    render(<I18nProvider><TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} /></I18nProvider>);
    const b = itCat.trainings.builder;
    await waitFor(() => expect(screen.getByLabelText(b.name)).toBeInTheDocument());
    expectItalianAndClean([b.name, b.ageGroupTarget, b.addExercise, b.save, b.cancel]);
    expectNoEnglish([enCat.trainings.builder.addExercise, enCat.trainings.builder.ageGroupTarget]);
  });
});
