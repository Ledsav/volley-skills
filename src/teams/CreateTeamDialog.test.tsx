import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateTeamDialog } from './CreateTeamDialog';
import * as teamsApi from './teamsApi';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';

vi.mock('./teamsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

describe('CreateTeamDialog', () => {
  it('submits the form fields to createTeam and calls onCreated', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'coach-uid', email: 'Coach@Example.com' } as never, appUser: { uid: 'coach-uid', email: 'coach@example.com' } })
    );
    const createTeamSpy = vi.spyOn(teamsApi, 'createTeam').mockResolvedValue('team-1');
    const onCreated = vi.fn();

    render(<CreateTeamDialog onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'U17' } });
    fireEvent.change(screen.getByLabelText('Age group'), { target: { value: 'U17' } });
    fireEvent.change(screen.getByLabelText('Season'), { target: { value: '2026-27' } });
    fireEvent.change(screen.getByLabelText('Team type'), { target: { value: 'women' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createTeamSpy).toHaveBeenCalledWith(
      { name: 'U17', ageGroup: 'U17', season: '2026-27', description: '', gender: 'women' },
      'coach-uid',
      'coach@example.com'
    );
  });

  it('keeps Create disabled until Women, Men or Mixed is chosen', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'coach-uid', email: 'Coach@Example.com' } as never, appUser: { uid: 'coach-uid', email: 'coach@example.com' } })
    );
    render(<CreateTeamDialog onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose…', 'Women', 'Men', 'Mixed']);
    fireEvent.change(screen.getByLabelText('Team type'), { target: { value: 'mixed' } });
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('shows an error message when createTeam is rejected', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'coach-uid', email: 'Coach@Example.com' } as never, appUser: { uid: 'coach-uid', email: 'coach@example.com' } })
    );
    vi.spyOn(teamsApi, 'createTeam').mockRejectedValue({ code: 'permission-denied' });
    const onCreated = vi.fn();

    render(<CreateTeamDialog onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'U17' } });
    fireEvent.change(screen.getByLabelText('Age group'), { target: { value: 'U17' } });
    fireEvent.change(screen.getByLabelText('Season'), { target: { value: '2026-27' } });
    fireEvent.change(screen.getByLabelText('Team type'), { target: { value: 'women' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('creates the team once even when Create is clicked twice', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'coach-uid', email: 'Coach@Example.com' } as never, appUser: { uid: 'coach-uid', email: 'coach@example.com' } })
    );
    const createTeamSpy = vi.spyOn(teamsApi, 'createTeam').mockReturnValue(new Promise(() => undefined));
    render(<CreateTeamDialog onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'U17' } });
    fireEvent.change(screen.getByLabelText('Age group'), { target: { value: 'U17' } });
    fireEvent.change(screen.getByLabelText('Season'), { target: { value: '2026-27' } });
    fireEvent.change(screen.getByLabelText('Team type'), { target: { value: 'women' } });
    fireEvent.click(screen.getByText('Create'));
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(createTeamSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('is a modal dialog: Escape closes it untouched, and asks before discarding typed changes', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid', email: 'Coach@Example.com' } as never, appUser: { uid: 'coach-uid', email: 'coach@example.com' } }));
    const onClose = vi.fn();
    const { unmount } = render(<CreateTeamDialog onClose={onClose} onCreated={vi.fn()} />);
    expect(await screen.findByRole('dialog', { name: 'Create team' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    onClose.mockClear();
    render(<CreateTeamDialog onClose={onClose} onCreated={vi.fn()} />);
    await screen.findByRole('dialog', { name: 'Create team' });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'U17' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument();
  });
});
