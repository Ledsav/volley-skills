import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayerContactSection } from './PlayerContactSection';
import * as playersApi from './playersApi';
import type { Player } from '../types/player';

vi.mock('./playersApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const basePlayer: Player = {
  id: 'player-1',
  number: 7,
  fullName: 'Test Player',
  dob: '2012-01-01',
  nationality: 'BEL',
  licenseNumber: 'J-000001',
  position: 'OH',
  playerPhone: '00352 000 000',
  guardians: [],
  viewerEmails: [],
  teamName: 'U17',
  ageGroup: 'U17',
  season: '2026-27',
  skills: {
    serve: { score: null, notes: '', priority: false },
    attack: { score: null, notes: '', priority: false },
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
  it('edits and saves the name, position, and phone', async () => {
    vi.spyOn(playersApi, 'updatePlayerContact').mockResolvedValue(undefined);
    const onPlayerUpdated = vi.fn();

    render(
      <PlayerContactSection teamId="team-1" playerId="player-1" player={basePlayer} onPlayerUpdated={onPlayerUpdated} />
    );

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated Name' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(playersApi.updatePlayerContact).toHaveBeenCalledWith('team-1', 'player-1', {
        fullName: 'Updated Name',
        position: 'OH',
        playerPhone: '00352 000 000',
      })
    );
    expect(onPlayerUpdated).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Updated Name' }));
  });

  it('shows an error message and stays in edit mode when the save is rejected', async () => {
    vi.spyOn(playersApi, 'updatePlayerContact').mockRejectedValue({ code: 'permission-denied' });
    const onPlayerUpdated = vi.fn();

    render(
      <PlayerContactSection teamId="team-1" playerId="player-1" player={basePlayer} onPlayerUpdated={onPlayerUpdated} />
    );

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onPlayerUpdated).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });
});
