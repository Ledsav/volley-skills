import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuardiansSection } from './GuardiansSection';
import * as playersApi from './playersApi';
import type { Player } from '../types/player';

vi.mock('./playersApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function GuardiansHarness({
  player,
  onPlayerUpdated = vi.fn(),
  isAdmin = true,
}: {
  player: Player;
  onPlayerUpdated?: (p: Player) => void;
  isAdmin?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      {isAdmin && <button onClick={() => setEditing(true)}>Edit</button>}
      <GuardiansSection
        teamId="team-1"
        playerId="player-1"
        player={player}
        onPlayerUpdated={onPlayerUpdated}
        isAdmin={isAdmin}
        editing={editing}
        onEditingChange={setEditing}
      />
    </>
  );
}

const basePlayer: Player = {
  id: 'player-1',
  number: 7,
  fullName: 'Test Player',
  dob: '2012-01-01',
  nationality: 'BEL',
  licenseNumber: 'J-000001',
  positionCategory: 'OH',
  starting: false,
  playerPhone: '',
  guardians: [{ relation: 'mother', name: 'Jane Doe', phone: '+352 000 000', email: 'jane@example.com' }],
  viewerEmails: [],
  teamName: 'U17',
  ageGroup: 'U17',
  season: '2026-27',
  skills: {
    serve: { score: null, notes: '', priority: false },
    attack: { score: null, notes: '', priority: false },
    block: { score: null, notes: '', priority: false },
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

describe('GuardiansSection', () => {
  it('shows guardians read-only and hides Edit when isAdmin is false', () => {
    render(
      <GuardiansHarness player={basePlayer} isAdmin={false} />
    );

    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('edits a guardian and saves', async () => {
    vi.spyOn(playersApi, 'updatePlayerGuardians').mockResolvedValue(undefined);
    const onPlayerUpdated = vi.fn();

    render(
      <GuardiansHarness player={basePlayer} onPlayerUpdated={onPlayerUpdated} />
    );

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Guardian phone'), { target: { value: '+352 111 111' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(playersApi.updatePlayerGuardians).toHaveBeenCalledWith('team-1', 'player-1', [
        { relation: 'mother', name: 'Jane Doe', phone: '+352 111 111', email: 'jane@example.com' },
      ])
    );
    expect(onPlayerUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [{ relation: 'mother', name: 'Jane Doe', phone: '+352 111 111', email: 'jane@example.com' }],
      })
    );
  });

  it('discards edits when Cancel is clicked, instead of leaving them for the next edit session', () => {
    render(
      <GuardiansHarness player={basePlayer} />
    );

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Guardian phone'), { target: { value: '+352 999 999' } });
    fireEvent.click(screen.getByText('Cancel'));

    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByLabelText('Guardian phone')).toHaveValue('+352 000 000');
  });
});
