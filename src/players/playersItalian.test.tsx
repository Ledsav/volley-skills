import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddPlayerDialog } from './AddPlayerDialog';
import { PlayerContactSection } from './PlayerContactSection';
import { PlayerIdentityCard } from './PlayerIdentityCard';
import { PlayerSkillsSection } from './PlayerSkillsSection';
import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';
import { LevelPill } from '../components/LevelPill';
import { NoticeProvider } from '../components/Notice';
import * as playersApi from './playersApi';
import { useAuth } from '../auth/AuthContext';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/en';
import { it as itCatalog } from '../i18n/it';
import { authValue } from '../test/authValue';
import type { DevelopmentPlan } from '../types/developmentPlan';
import type { Player } from '../types/player';
import type { Team } from '../types/team';

import { EMPTY_ONBOARDING } from '../onboarding/onboardingState';
vi.mock('./playersApi');
vi.mock('../skillGuide/skillGuideApi', () => ({ getSkillGuide: vi.fn().mockResolvedValue({ skills: [] }) }));
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

const team: Team = {
  id: 'team-1',
  name: 'U17',
  ageGroup: 'U17',
  season: '2026-27',
  description: '',
  notes: '',
  gender: 'women',
  adminEmails: ['coach@example.com'],
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  createdBy: 'coach-uid',
  createdAt: null,
};

const player = {
  id: 'player-1',
  number: 7,
  fullName: 'Giulia Rossi',
  dob: '2012-01-01',
  nationality: 'ITA',
  licenseNumber: 'J-1',
  positionCategory: 'OH',
  shirtSize: '',
  starting: true,
  playerPhone: '',
  guardians: [],
  teamName: 'U17',
  ageGroup: 'U17',
  season: '2026-27',
  skills: Object.fromEntries(
    ['serve', 'attack', 'block', 'set', 'defence', 'reception', 'jump', 'speed', 'iq'].map((k) => [k, { score: 6, notes: '', priority: false }])
  ),
  avgScore: 6.5,
  level: 'Advanced',
} as unknown as Player;

describe('players in Italian', () => {
  beforeEach(() => {
    window.localStorage.setItem('vcb.locale', 'it');
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never, appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING } })
    );
  });

  it('shows positions in Italian but saves the English position code when adding a player', async () => {
    const createPlayer = vi.spyOn(playersApi, 'createPlayer').mockResolvedValue('player-1');
    const onCreated = vi.fn();
    render(
      <I18nProvider>
        <AddPlayerDialog teamId="team-1" team={team} onClose={vi.fn()} onCreated={onCreated} />
      </I18nProvider>
    );

    const position = await screen.findByLabelText('Ruolo');
    expect(screen.getByRole('option', { name: 'Schiacciatrice (banda)' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Numero'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Nome e cognome'), { target: { value: 'Giulia Rossi' } });
    fireEvent.change(screen.getByLabelText('Data di nascita'), { target: { value: '2012-01-01' } });
    fireEvent.change(position, { target: { value: 'OH' } });
    fireEvent.change(screen.getByLabelText('Nome del tutore'), { target: { value: 'Anna Rossi' } });
    fireEvent.click(screen.getByLabelText(/Confermo che un genitore/));
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createPlayer).toHaveBeenCalledWith(
      'team-1',
      team,
      expect.objectContaining({ positionCategory: 'OH', guardians: [expect.objectContaining({ relation: 'mother' })] }),
      'coach-uid',
      'coach@example.com'
    );
  });

  it('saves the English position code from the contact dialog', async () => {
    const update = vi.spyOn(playersApi, 'updatePlayerContact').mockResolvedValue(undefined);
    function Harness() {
      const [editing, setEditing] = useState(false);
      return (
        <>
          <button onClick={() => setEditing(true)}>apri</button>
          <PlayerContactSection
            teamId="team-1"
            playerId="player-1"
            player={player}
            onPlayerUpdated={vi.fn()}
            isAdmin
            editing={editing}
            onEditingChange={setEditing}
            gender="women"
          />
        </>
      );
    }
    render(<I18nProvider><Harness /></I18nProvider>);
    fireEvent.click(await screen.findByText('apri'));
    fireEvent.change(await screen.findByLabelText('Ruolo'), { target: { value: 'MB' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith('team-1', 'player-1', expect.objectContaining({ positionCategory: 'MB' }));
  });

  it('saves the English objective status from the development plan editor', async () => {
    const plan: DevelopmentPlan = {
      shortTermObjectives: [{ objective: 'Migliorare la battuta', targetDate: '2026-12-01', status: 'Not started', coachComment: '' }],
      seasonObjectives: [],
      generalNotes: '',
    };
    const onSave = vi.fn().mockResolvedValue(undefined);
    function Harness() {
      const [editing, setEditing] = useState(false);
      return (
        <>
          <button onClick={() => setEditing(true)}>apri</button>
          <DevelopmentPlanEditor plan={plan} onSave={onSave} isAdmin editing={editing} onEditingChange={setEditing} />
        </>
      );
    }
    render(<I18nProvider><Harness /></I18nProvider>);
    fireEvent.click(await screen.findByText('apri'));
    const status = await screen.findByLabelText('Stato');
    expect(screen.getByRole('option', { name: 'Completato' })).toBeInTheDocument();
    fireEvent.change(status, { target: { value: 'Completed' } });
    fireEvent.submit(status.closest('form')!);

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].shortTermObjectives[0].status).toBe('Completed');
  });

  it('words the position and level by the team gender', async () => {
    const { unmount } = render(
      <I18nProvider>
        <PlayerIdentityCard player={player} gender="women" />
      </I18nProvider>
    );
    expect(await screen.findByText(/Schiacciatrice \(banda\)/)).toBeInTheDocument();
    expect(screen.getByText('Avanzata')).toBeInTheDocument();
    unmount();

    render(
      <I18nProvider>
        <PlayerIdentityCard player={player} gender="men" />
      </I18nProvider>
    );
    expect(await screen.findByText(/Schiacciatore \(banda\)/)).toBeInTheDocument();
    expect(screen.getByText('Avanzato')).toBeInTheDocument();
  });

  it('words the level pill and the skills average by the team gender', async () => {
    render(
      <I18nProvider>
        <NoticeProvider>
          <LevelPill level="Advanced" gender="women" />
          <PlayerSkillsSection
            teamId="team-1"
            playerId="player-1"
            player={player}
            onPlayerUpdated={vi.fn()}
            isAdmin={false}
            editing={false}
            onEditingChange={vi.fn()}
            gender="women"
          />
        </NoticeProvider>
      </I18nProvider>
    );
    expect(await screen.findByText('Avanzata')).toBeInTheDocument();
    expect(screen.getByText(/\(Avanzata\)/)).toBeInTheDocument();
    expect(screen.getAllByText('Lettura del gioco').length).toBeGreaterThan(0);
  });

  it('words player-naming texts by the team gender, and English ignores it', () => {
    expect(itCatalog.players.card.deleteMessage('women')).toContain('della giocatrice');
    expect(itCatalog.players.card.deleteMessage('men')).toContain('del giocatore');
    expect(itCatalog.players.card.deleteMessage('mixed')).toContain('del/della giocatore/trice');
    expect(itCatalog.players.card.notFoundMessage('women')).toContain('stata eliminata');
    expect(itCatalog.players.card.markLeft('women')).toBe('Segna come uscita dal club');
    expect(en.players.card.deleteMessage('women')).toBe(en.players.card.deleteMessage('men'));
    expect(en.players.card.markLeft('women')).toBe('Mark as left the club');
  });
});
