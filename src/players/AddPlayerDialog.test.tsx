import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddPlayerDialog } from './AddPlayerDialog';
import * as playersApi from './playersApi';
import { useAuth } from '../auth/AuthContext';
import type { Team } from '../types/team';

vi.mock('./playersApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const team: Team = {
  id: 'team-1',
  name: 'U17',
  club: 'VCB',
  ageGroup: 'U17',
  season: '2026-27',
  description: '',
  notes: '',
  adminEmails: ['coach@example.com'],
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  createdBy: 'coach-uid',
  createdAt: null,
};

describe('AddPlayerDialog', () => {
  it('submits the form with guardians and confirmed consent', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    const createPlayerSpy = vi.spyOn(playersApi, 'createPlayer').mockResolvedValue('player-1');
    const onCreated = vi.fn();

    render(<AddPlayerDialog teamId="team-1" team={team} onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test Player' } });
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2012-01-01' } });
    fireEvent.change(screen.getByLabelText('Nationality'), { target: { value: 'BEL' } });
    fireEvent.change(screen.getByLabelText('License #'), { target: { value: 'J-000001' } });
    fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'OH' } });
    fireEvent.change(screen.getByLabelText('Guardian name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText('Guardian phone'), { target: { value: '+352 000 000' } });
    fireEvent.change(screen.getByLabelText('Guardian email'), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByLabelText(/confirm parental\/guardian consent/i));
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createPlayerSpy).toHaveBeenCalledWith(
      'team-1',
      team,
      expect.objectContaining({
        number: 7,
        fullName: 'Test Player',
        guardians: [{ relation: 'mother', name: 'Jane Doe', phone: '+352 000 000', email: 'jane@example.com' }],
      }),
      'coach-uid',
      'coach@example.com'
    );
  });

  it('does not submit when consent is not confirmed', () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    const createPlayerSpy = vi.spyOn(playersApi, 'createPlayer').mockResolvedValue('player-1');

    render(<AddPlayerDialog teamId="team-1" team={team} onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test Player' } });
    fireEvent.change(screen.getByLabelText('Guardian name'), { target: { value: 'Jane Doe' } });
    fireEvent.click(screen.getByText('Create'));

    expect(createPlayerSpy).not.toHaveBeenCalled();
  });

  it('does not submit when every other required field is filled but consent is unchecked', () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    const createPlayerSpy = vi.spyOn(playersApi, 'createPlayer').mockResolvedValue('player-1');

    render(<AddPlayerDialog teamId="team-1" team={team} onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test Player' } });
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2012-01-01' } });
    fireEvent.change(screen.getByLabelText('Guardian name'), { target: { value: 'Jane Doe' } });
    // Consent checkbox intentionally left unchecked — this isolates it as the sole blocker.
    fireEvent.click(screen.getByText('Create'));

    expect(createPlayerSpy).not.toHaveBeenCalled();
  });

  it('adds a second guardian row', () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });

    render(<AddPlayerDialog teamId="team-1" team={team} onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getAllByLabelText('Guardian name')).toHaveLength(1);
    fireEvent.click(screen.getByText('+ Add guardian'));
    expect(screen.getAllByLabelText('Guardian name')).toHaveLength(2);
  });
});
