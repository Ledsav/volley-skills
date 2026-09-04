import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateTeamDialog } from './CreateTeamDialog';
import * as teamsApi from './teamsApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./teamsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

describe('CreateTeamDialog', () => {
  it('submits the form fields to createTeam and calls onCreated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
    });
    const createTeamSpy = vi.spyOn(teamsApi, 'createTeam').mockResolvedValue('team-1');
    const onCreated = vi.fn();

    render(<CreateTeamDialog onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'U17' } });
    fireEvent.change(screen.getByLabelText('Club'), { target: { value: 'VCB' } });
    fireEvent.change(screen.getByLabelText('Age group'), { target: { value: 'U17' } });
    fireEvent.change(screen.getByLabelText('Season'), { target: { value: '2026-27' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createTeamSpy).toHaveBeenCalledWith(
      { name: 'U17', club: 'VCB', ageGroup: 'U17', season: '2026-27', description: '' },
      'coach-uid',
      'coach@example.com'
    );
  });
});
