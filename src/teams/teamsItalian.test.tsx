import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTeamDialog } from './CreateTeamDialog';
import { TeamRosterTable } from './TeamRosterTable';
import * as teamsApi from './teamsApi';
import * as playersApi from '../players/playersApi';
import { useAuth } from '../auth/AuthContext';
import { I18nProvider } from '../i18n/I18nProvider';
import { authValue } from '../test/authValue';
import type { Player } from '../types/player';

vi.mock('./teamsApi');
vi.mock('../players/playersApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

const player = { id: 'p1', number: 4, fullName: 'Giulia Rossi', dob: '2012-01-01', positionCategory: 'OH', level: 'Advanced', avgScore: 6.5, starting: false } as Player;

describe('teams in Italian', () => {
  beforeEach(() => {
    window.localStorage.setItem('vcb.locale', 'it');
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'u1', email: 'c@example.com' } as never, appUser: { uid: 'u1', email: 'c@example.com' } }),
    );
  });

  it('shows the team type in Italian but saves the English code', async () => {
    const createTeam = vi.spyOn(teamsApi, 'createTeam').mockResolvedValue('team-1');
    const onCreated = vi.fn();
    render(<I18nProvider><CreateTeamDialog onClose={vi.fn()} onCreated={onCreated} /></I18nProvider>);

    const select = await screen.findByLabelText('Tipo di squadra');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Scegli…', 'Femminile', 'Maschile', 'Mista']);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'U17' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'U17' } });
    fireEvent.change(screen.getByLabelText('Stagione'), { target: { value: '2026-27' } });
    fireEvent.change(select, { target: { value: 'women' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createTeam).toHaveBeenCalledWith(expect.objectContaining({ gender: 'women' }), 'u1', 'c@example.com');
  });

  it('words the position by the team gender', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [player], lastDoc: null, hasMore: false });
    const { unmount } = render(<MemoryRouter><I18nProvider><TeamRosterTable teamId="t1" gender="women" /></I18nProvider></MemoryRouter>);
    expect((await screen.findAllByText('Schiacciatrice (banda)')).length).toBeGreaterThan(0);
    unmount();
    render(<MemoryRouter><I18nProvider><TeamRosterTable teamId="t1" gender="men" /></I18nProvider></MemoryRouter>);
    expect((await screen.findAllByText('Schiacciatore (banda)')).length).toBeGreaterThan(0);
  });
});
