import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerSkillsSection } from './PlayerSkillsSection';
import { formatPhysicalTestSummary } from './physicalTestFormat';
import { I18nProvider, useT } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';
import type { Player } from '../types/player';

const mockGetDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: vi.fn(),
  serverTimestamp: () => 'server-timestamp',
}));
vi.mock('./playersApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

const player = {
  id: 'player-1',
  number: 7,
  fullName: 'Giulia Rossi',
  dob: '2012-01-01',
  positionCategory: 'OH',
  guardians: [],
  skills: Object.fromEntries(
    ['serve', 'attack', 'block', 'set', 'defence', 'reception', 'jump', 'speed', 'iq'].map((k) => [k, { score: 6, notes: '', priority: false }])
  ),
  avgScore: 6,
  level: 'Developing',
} as unknown as Player;

describe('guide fallback and decimals in Italian', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    window.localStorage.setItem('vcb.locale', 'it');
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid' } as never }));
  });

  it('shows the Italian default guide in the skill tooltips when no guide is saved', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    render(
      <I18nProvider>
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
      </I18nProvider>
    );

    const trigger = await screen.findByRole('button', { name: 'Guida al punteggio: Battuta' });
    fireEvent.focus(trigger);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Irregolare, molti errori.');
  });

  it('writes test results with a decimal comma', async () => {
    function Probe() {
      useT(); // re-render when the Italian catalog arrives
      return (
        <p>
          {formatPhysicalTestSummary({
            id: 't', date: '2026-09-07', notes: '', recordedBy: 'c', createdAt: null,
            testType: 'sprint10m', attemptsSeconds: [1.85], bestSeconds: 1.85,
          })}
        </p>
      );
    }
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(await screen.findByText('1,85 s')).toBeInTheDocument();
  });
});
