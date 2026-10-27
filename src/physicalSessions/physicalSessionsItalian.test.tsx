import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionQualityPanel } from './SessionQualityPanel';
import { I18nProvider } from '../i18n/I18nProvider';
import * as physicalTestsApi from '../players/physicalTestsApi';

vi.mock('./testingSessionsApi');
vi.mock('../players/physicalTestsApi');
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ club: null }) }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

describe('physical sessions in Italian', () => {
  beforeEach(() => {
    window.localStorage.setItem('vcb.locale', 'it');
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);
  });

  it('labels the test in Italian and writes recorded attempts with a decimal comma', async () => {
    render(
      <I18nProvider>
        <SessionQualityPanel
          teamId="team-1"
          sessionId="session-1"
          sessionDate="2026-09-16"
          playerId="player-1"
          playerName="Giulia Rossi"
          testType="broadJump"
          entry={{ id: 'e', playerId: 'player-1', testType: 'broadJump', status: 'in_progress', data: { broadJumpAttempts: [2.35] } } as never}
          recordedByUid="coach-uid"
          onClose={vi.fn()}
          onFinished={vi.fn()}
        />
      </I18nProvider>
    );

    expect(await screen.findByRole('dialog', { name: 'Salto in lungo da fermo — Giulia Rossi' })).toBeInTheDocument();
    expect(screen.getByText('2,35 cm')).toBeInTheDocument();
    expect(screen.getByLabelText('Nuovo tentativo (cm)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Concludi' })).toBeInTheDocument();
  });
});
