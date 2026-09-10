import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayerContactSection } from './PlayerContactSection';
import * as playersApi from './playersApi';
import type { Player } from '../types/player';

vi.mock('./playersApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function ContactHarness({
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
      <PlayerContactSection
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
  playerPhone: '00352 000 000',
  guardians: [],
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
  consent: { given: false, date: null, confirmedBy: null },
  createdBy: 'coach-uid',
  createdAt: null,
  updatedAt: null,
};

describe('PlayerContactSection', () => {
  it('edits and saves the name and phone', async () => {
    vi.spyOn(playersApi, 'updatePlayerContact').mockResolvedValue(undefined);
    const onPlayerUpdated = vi.fn();

    render(
      <ContactHarness player={basePlayer} onPlayerUpdated={onPlayerUpdated} />
    );

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated Name' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(playersApi.updatePlayerContact).toHaveBeenCalledWith('team-1', 'player-1', {
        fullName: 'Updated Name',
        number: 7,
        positionCategory: 'OH',
        starting: false,
        playerPhone: '00352 000 000',
      })
    );
    expect(onPlayerUpdated).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Updated Name' }));
  });

  it('edits and saves the shirt number', async () => {
    vi.spyOn(playersApi, 'updatePlayerContact').mockResolvedValue(undefined);
    const onPlayerUpdated = vi.fn();

    render(<ContactHarness player={{ ...basePlayer, number: 0 }} onPlayerUpdated={onPlayerUpdated} />);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText(/shirt number/i), { target: { value: '9' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(playersApi.updatePlayerContact).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        expect.objectContaining({ number: 9 })
      )
    );
    expect(onPlayerUpdated).toHaveBeenCalledWith(expect.objectContaining({ number: 9 }));
  });

  it('edits and saves the position category and starting flag', async () => {
    vi.spyOn(playersApi, 'updatePlayerContact').mockResolvedValue(undefined);
    const onPlayerUpdated = vi.fn();

    render(<ContactHarness player={basePlayer} onPlayerUpdated={onPlayerUpdated} />);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'S' } });
    fireEvent.click(screen.getByLabelText(/starting/i));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(playersApi.updatePlayerContact).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        expect.objectContaining({ positionCategory: 'S', starting: true })
      )
    );
    expect(onPlayerUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ positionCategory: 'S', starting: true })
    );
  });

  it('shows the position category and lineup status in the read view', () => {
    render(<ContactHarness player={{ ...basePlayer, positionCategory: 'MB', starting: true }} isAdmin={false} />);

    expect(screen.getByText('Middle')).toBeInTheDocument();
    expect(screen.getByText(/starting/i)).toBeInTheDocument();
  });

  it('shows an error message and stays in edit mode when the save is rejected', async () => {
    vi.spyOn(playersApi, 'updatePlayerContact').mockRejectedValue({ code: 'permission-denied' });
    const onPlayerUpdated = vi.fn();

    render(
      <ContactHarness player={basePlayer} onPlayerUpdated={onPlayerUpdated} />
    );

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onPlayerUpdated).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('hides the edit affordance for a non-admin viewer', () => {
    render(<ContactHarness player={basePlayer} isAdmin={false} />);

    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.getByText('Outside')).toBeInTheDocument();
    expect(screen.getByText('00352 000 000')).toBeInTheDocument();
  });
});
