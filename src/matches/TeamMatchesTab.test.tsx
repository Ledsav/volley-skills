import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WithChrome } from '../test/chromeProbe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type Match } from '../types/match';
import { TeamMatchesTab } from './TeamMatchesTab';
import * as matchesApi from './matchesApi';

vi.mock('./matchesApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: { uid: 'u1' } }) }));
vi.mock('./dvw/DvwImportDialog', () => ({ DvwImportDialog: () => <p>dvw-dialog</p> }));
vi.mock('./MatchSetupForm', () => ({
  MatchSetupForm: ({ defaultDate, onSubmit }: { defaultDate?: string; onSubmit: (input: unknown) => Promise<void> | void }) => (
    <div>
      <p>setup-form {defaultDate}</p>
      <button onClick={() => void onSubmit({ opponent: 'New FC' })}>mock-create</button>
    </div>
  ),
}));

const match = (over: Partial<Match>): Match => ({
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT,
  roster: [], liberos: [], status: 'finished', result: { setsUs: 3, setsThem: 1, sets: [] }, summary: null,
  usageContribution: null, activeDevice: null, createdBy: 'u1', createdAt: null, updatedAt: null, ...over,
});

describe('TeamMatchesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(matchesApi.listMatches).mockResolvedValue({
      matches: [match({}), match({ id: 'm2', opponent: 'Live FC', status: 'live', result: { setsUs: 1, setsThem: 0, sets: [] } })],
      lastDoc: null,
      hasMore: false,
    });
  });

  it('lists matches with result and status', async () => {
    render(<MemoryRouter><WithChrome><TeamMatchesTab teamId="t1" teamName="Team" /></WithChrome></MemoryRouter>);
    expect(await screen.findByText('Rivals')).toBeInTheDocument();
    expect(screen.getByText('3–1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resume/i })).toHaveAttribute('href', '/teams/t1/matches/m2/scout');
  });

  it('opens the setup form, pre-filled from the calendar date', async () => {
    render(<MemoryRouter><WithChrome><TeamMatchesTab teamId="t1" teamName="Team" newMatchDate="2026-11-02" /></WithChrome></MemoryRouter>);
    expect(await screen.findByText('setup-form 2026-11-02')).toBeInTheDocument();
  });

  it('opens the setup form from a pending action', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/teams/t1', search: '?tab=matches', state: { pendingAction: 'new-match' } }]}>
        <WithChrome><TeamMatchesTab teamId="t1" teamName="Team" /></WithChrome>
      </MemoryRouter>
    );
    expect(await screen.findByText(/^setup-form [0-9]{4}-[0-9]{2}-[0-9]{2}$/)).toBeInTheDocument();
  });

  it('opens the setup form from the button', async () => {
    render(<MemoryRouter><WithChrome><TeamMatchesTab teamId="t1" teamName="Team" /></WithChrome></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /new match/i }));
    expect(screen.getByText(/setup-form/)).toBeInTheDocument();
  });

  it('creates the match without waiting for the server and opens it', async () => {
    vi.mocked(matchesApi.createMatch).mockReturnValue({ id: 'new-m', written: new Promise<void>(() => undefined) });
    render(
      <MemoryRouter initialEntries={['/teams/t1']}>
        <Routes>
          <Route path="/teams/:teamId" element={<WithChrome><TeamMatchesTab teamId="t1" teamName="Team" /></WithChrome>} />
          <Route path="/teams/:teamId/matches/:matchId" element={<p>match page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /new match/i }));
    fireEvent.click(screen.getByText('mock-create'));
    expect(await screen.findByText('match page')).toBeInTheDocument();
    expect(matchesApi.createMatch).toHaveBeenCalledWith('t1', { opponent: 'New FC' }, 'u1');
  });

  it('season awards is in More for a team admin only', async () => {
    const { unmount } = render(<MemoryRouter><WithChrome><TeamMatchesTab teamId="t1" teamName="Team" /></WithChrome></MemoryRouter>);
    await screen.findByText('Rivals');
    expect(screen.getByRole('button', { name: /import from datavolley/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Season awards' })).not.toBeInTheDocument();
    unmount();
    render(
      <MemoryRouter initialEntries={['/teams/t1']}>
        <Routes>
          <Route path="/teams/:teamId" element={<WithChrome><TeamMatchesTab teamId="t1" teamName="Team" admin /></WithChrome>} />
          <Route path="/teams/:teamId/awards" element={<p>awards page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText('Rivals');
    fireEvent.click(screen.getByRole('button', { name: 'Season awards' }));
    expect(await screen.findByText('awards page')).toBeInTheDocument();
  });

  it('a live row offers Open and Scout; Delete asks first and removes the row after the delete', async () => {
    vi.mocked(matchesApi.deleteMatch).mockResolvedValue(undefined);
    render(<MemoryRouter><WithChrome><TeamMatchesTab teamId="t1" teamName="Team" /></WithChrome></MemoryRouter>);
    const row = (await screen.findByText('Live FC')).closest('li') as HTMLElement;
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    const menu = screen.getByRole('menu', { name: 'Actions for vs Live FC' });
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Open', 'Scout', 'Delete…']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete…' }));
    expect(matchesApi.deleteMatch).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this match?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, delete' }));
    expect(matchesApi.deleteMatch).toHaveBeenCalledWith('t1', 'm2');
    await waitFor(() => expect(screen.queryByText('Live FC')).not.toBeInTheDocument());
    expect(screen.getByText('Rivals')).toBeInTheDocument();
  });

  it('a finished row offers Report and Delete', async () => {
    render(<MemoryRouter><WithChrome><TeamMatchesTab teamId="t1" teamName="Team" /></WithChrome></MemoryRouter>);
    const row = (await screen.findByText('Rivals')).closest('li') as HTMLElement;
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    const menu = screen.getByRole('menu', { name: 'Actions for vs Rivals' });
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Report', 'Delete…']);
  });

  it('a failed delete keeps the row and shows the error in the dialog', async () => {
    vi.mocked(matchesApi.deleteMatch).mockRejectedValue(new Error('nope'));
    render(<MemoryRouter><WithChrome><TeamMatchesTab teamId="t1" teamName="Team" /></WithChrome></MemoryRouter>);
    const row = (await screen.findByText('Rivals')).closest('li') as HTMLElement;
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, delete' }));
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('Could not delete the match. Please try again.');
    expect(screen.getByText('Rivals')).toBeInTheDocument();
  });

  it('shows skeleton rows, not the empty text, until the first page arrives', async () => {
    let resolve: (v: { matches: Match[]; lastDoc: null; hasMore: boolean }) => void = () => undefined;
    vi.mocked(matchesApi.listMatches).mockReturnValue(new Promise((r) => { resolve = r; }));
    const { container } = render(<MemoryRouter><WithChrome><TeamMatchesTab teamId="t1" teamName="Team" /></WithChrome></MemoryRouter>);
    expect(container.querySelectorAll('[data-skeleton-block]')).toHaveLength(3);
    expect(screen.queryByText('No matches yet.')).not.toBeInTheDocument();
    resolve({ matches: [], lastDoc: null, hasMore: false });
    expect(await screen.findByText('No matches yet.')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-skeleton-block]')).toHaveLength(0);
  });

  describe('DataVolley import', () => {
    afterEach(() => vi.restoreAllMocks());

    it('opens the import dialog online', async () => {
      render(<MemoryRouter><WithChrome><TeamMatchesTab teamId="t1" teamName="Team" /></WithChrome></MemoryRouter>);
      fireEvent.click(await screen.findByRole('button', { name: /import from datavolley/i }));
      expect(screen.getByText('dvw-dialog')).toBeInTheDocument();
    });

    it('disables the DataVolley import offline', async () => {
      vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
      render(<MemoryRouter><WithChrome><TeamMatchesTab teamId="t1" teamName="Team" /></WithChrome></MemoryRouter>);
      expect(await screen.findByRole('button', { name: /import from datavolley/i })).toBeDisabled();
      expect(screen.getByText('Connect to the internet to import.')).toBeInTheDocument();
    });
  });

  describe('new-match default date', () => {
    afterEach(() => vi.useRealTimers());

    it("uses the local calendar date, not the UTC one", async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 14, 0, 30));
      render(<MemoryRouter><WithChrome><TeamMatchesTab teamId="t1" teamName="Team" /></WithChrome></MemoryRouter>);
      fireEvent.click(await screen.findByRole('button', { name: /new match/i }));
      expect(screen.getByText('setup-form 2026-10-14')).toBeInTheDocument();
    });
  });
});
