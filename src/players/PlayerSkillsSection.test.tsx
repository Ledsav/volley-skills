import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayerSkillsSection } from './PlayerSkillsSection';
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
  playerPhone: '',
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

describe('PlayerSkillsSection', () => {
  it('sets a score, computes avg/level, and saves', async () => {
    vi.spyOn(playersApi, 'updatePlayerSkills').mockResolvedValue(undefined);
    const onPlayerUpdated = vi.fn();

    render(
      <PlayerSkillsSection teamId="team-1" playerId="player-1" player={basePlayer} onPlayerUpdated={onPlayerUpdated} />
    );

    fireEvent.change(screen.getByLabelText('Serve'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Attack'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('Save skills'));

    await waitFor(() =>
      expect(playersApi.updatePlayerSkills).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        expect.objectContaining({
          serve: expect.objectContaining({ score: 6 }),
          attack: expect.objectContaining({ score: 8 }),
        }),
        7,
        'Advanced'
      )
    );
    expect(onPlayerUpdated).toHaveBeenCalledWith(expect.objectContaining({ avgScore: 7, level: 'Advanced' }));
  });

  it('marks a skill as a focus area via the priority checkbox', () => {
    render(
      <PlayerSkillsSection teamId="team-1" playerId="player-1" player={basePlayer} onPlayerUpdated={vi.fn()} />
    );

    const checkboxes = screen.getAllByLabelText('Focus area');
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();
  });
});
