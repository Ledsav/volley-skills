import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authValue } from '../test/authValue';
import type { Team } from '../types/team';
import * as teamsApi from '../teams/teamsApi';
import * as matchesApi from '../matches/matchesApi';
import * as exportCards from './exportCards';
import * as awardsApi from './awardsApi';
import { finished, player } from './testMatches';
import AwardsPage, { gatedArt, photoAllowedKeys } from './AwardsPage';
import type { ResolvedAward } from './resolveAwards';
import type { Player } from '../types/player';

vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../teams/teamsApi');
vi.mock('./awardsApi');
vi.mock('../matches/matchesApi', async (orig) => ({
  ...(await orig<typeof import('../matches/matchesApi')>()),
  getMatch: vi.fn(), listFinishedMatches: vi.fn(), loadTeamRoster: vi.fn(),
}));
vi.mock('./exportCards', async (orig) => ({
  ...(await orig<typeof import('./exportCards')>()),
  ensureCardFonts: vi.fn().mockResolvedValue(undefined),
  renderPng: vi.fn(),
}));
let nextCrop: HTMLCanvasElement[] = [];
vi.mock('./PhotoCropDialog', () => ({
  PhotoCropDialog: ({ open, onDone }: { open: boolean; onDone: (c: HTMLCanvasElement) => void }) =>
    open ? <button onClick={() => onDone(nextCrop.shift()!)}>Done crop</button> : null,
}));
const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: () => useAuthMock() }));

const team = { id: 't1', name: 'U17 Girls', season: '2026-27', adminEmails: ['user@example.com'] } as unknown as Team;
const m = finished('m1', '2026-10-12', [player('a', { A: '########' })]);

function renderAt(path: string, scope: 'season' | 'match') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/teams/:teamId/awards" element={<AwardsPage scope={scope} />} />
        <Route path="/teams/:teamId/matches/:matchId/awards" element={<AwardsPage scope={scope} />} />
        <Route path="/teams/:teamId" element={<p>team page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const flush = () => act(async () => { await Promise.resolve(); });

describe('AwardsPage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    useAuthMock.mockReturnValue(authValue());
    vi.mocked(teamsApi.getTeam).mockResolvedValue(team);
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([m]);
    vi.mocked(matchesApi.getMatch).mockResolvedValue(m);
    vi.mocked(matchesApi.loadTeamRoster).mockResolvedValue([
      { id: 'a', fullName: 'Player a', number: 1, consent: { given: true, date: null, confirmedBy: null } },
      { id: 'b', fullName: 'Player b', number: 2, consent: { given: false, date: null, confirmedBy: null } },
    ] as unknown as Player[]);
    sessionStorage.clear();
    vi.mocked(awardsApi.getSeasonAwards).mockResolvedValue(null);
    vi.mocked(awardsApi.saveSeasonAwards).mockResolvedValue();
    vi.mocked(awardsApi.saveMatchAwards).mockResolvedValue();
  });

  it('season: loads, shows awards, saves an override (debounced)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/teams/t1/awards', 'season');
    const row = await screen.findByRole('region', { name: 'Best attacker' });
    fireEvent.change(row.querySelector('select')!, { target: { value: 'a' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(awardsApi.saveSeasonAwards).toHaveBeenCalledWith('t1', expect.objectContaining({ picks: { attacker: { playerId: 'a', hidden: false } } }), 'u-1');
  });

  it('initial load never saves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/teams/t1/awards', 'season');
    await screen.findByRole('region', { name: 'Best attacker' });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(awardsApi.saveSeasonAwards).not.toHaveBeenCalled();
  });

  it('flushes a pending edit when the page unmounts before the debounce fires', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { unmount } = renderAt('/teams/t1/awards', 'season');
    const row = await screen.findByRole('region', { name: 'Best attacker' });
    fireEvent.change(row.querySelector('select')!, { target: { value: 'a' } });
    expect(awardsApi.saveSeasonAwards).not.toHaveBeenCalled();
    unmount();
    expect(awardsApi.saveSeasonAwards).toHaveBeenCalledTimes(1);
    expect(awardsApi.saveSeasonAwards).toHaveBeenCalledWith('t1', expect.objectContaining({ picks: { attacker: { playerId: 'a', hidden: false } } }), 'u-1');
  });

  it('a non-permission load error is retryable, not "not found"', async () => {
    vi.mocked(teamsApi.getTeam).mockRejectedValueOnce(new Error('network'));
    renderAt('/teams/t1/awards', 'season');
    expect(await screen.findByText('Could not load awards.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Awards not found' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Best attacker' })).toBeInTheDocument();
  });

  it('loads card fonts before showing the page', async () => {
    renderAt('/teams/t1/awards', 'season');
    await screen.findByRole('region', { name: 'Best attacker' });
    expect(exportCards.ensureCardFonts).toHaveBeenCalled();
  });

  it('adding a second photo keeps the first photo alive', async () => {
    const a = document.createElement('canvas'); a.width = 300;
    const b = document.createElement('canvas'); b.width = 300;
    nextCrop = [a, b];
    renderAt('/teams/t1/awards', 'season');
    await screen.findByRole('region', { name: 'Best attacker' });
    // photos need a winner with consent: player a wins Top scorer and MVP in this fixture
    const scorer = screen.getByRole('region', { name: /scorer/i });
    const pick = async (row: HTMLElement) => {
      fireEvent.change(row.querySelector('input[type=file]')!, { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } });
      fireEvent.click(await screen.findByRole('button', { name: 'Done crop' }));
      await flush();
    };
    await pick(scorer);
    await pick(screen.getByRole('region', { name: 'MVP' }));
    expect(a.width).toBe(300);
    expect(b.width).toBe(300);
  });

  it('shows an inline alert when exporting fails', async () => {
    vi.mocked(exportCards.renderPng).mockRejectedValue(new Error('boom'));
    renderAt('/teams/t1/awards', 'season');
    await screen.findByRole('region', { name: 'Best attacker' });
    fireEvent.click(screen.getByRole('button', { name: /Export cards/ }));
    // first share in a session asks about minors' images
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Share them only within the team');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not export');
  });

  it('match: unfinished match shows a message', async () => {
    vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...m, status: 'live' });
    renderAt('/teams/t1/matches/m1/awards', 'match');
    expect(await screen.findByText('Awards are available once the match is finished.')).toBeInTheDocument();
  });

  it('non-admins get not-found', async () => {
    vi.mocked(teamsApi.getTeam).mockResolvedValue({ ...team, adminEmails: ['other@x.be'] });
    renderAt('/teams/t1/awards', 'season');
    expect(await screen.findByRole('heading', { name: 'Awards not found' })).toBeInTheDocument();
  });

  it('Present switches to the ceremony and Escape returns', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    renderAt('/teams/t1/awards', 'season');
    await screen.findByRole('region', { name: 'Best attacker' });
    fireEvent.click(screen.getByRole('button', { name: /Present/ }));
    expect(screen.getByRole('button', { name: 'Exit presentation' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByRole('region', { name: 'Best attacker' })).toBeInTheDocument();
  });
});

describe('photoAllowedKeys', () => {
  const award = (key: string, playerId: string | null) => ({ key, winner: playerId ? { playerId, name: '', number: null, current: true } : null }) as unknown as ResolvedAward;
  it('allows photos only for winners with consent; former players and empty awards are excluded', () => {
    const keys = photoAllowedKeys([award('mvp', 'a'), award('server', 'b'), award('x', 'gone'), award('none', null)], new Set(['a']));
    expect([...keys]).toEqual(['mvp']);
  });
});

describe('gatedArt', () => {
  const photo = document.createElement('canvas');
  const cut = document.createElement('canvas');
  const photos = new Map([['mvp', photo]]);
  const cutouts = new Map([['mvp', cut]]);
  it('photo dropped when winner loses consent', () => {
    expect(gatedArt('mvp', new Set(['mvp']), photos, cutouts, null)).toEqual({ photo, cutout: cut, background: null });
    // the MVP winner was changed to a player without consent → mvp is no longer in the allowed set
    expect(gatedArt('mvp', new Set(), photos, cutouts, null)).toEqual({ photo: null, cutout: null, background: null });
  });
});
