import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AccessManagerPage } from './AccessManagerPage';
import * as accessApi from './accessApi';

vi.mock('./accessApi');
vi.mock('../firebase/config', () => ({ db: {} }));

const teams = [
  { id: 't1', name: 'U15' },
  { id: 't2', name: 'U17' },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(accessApi.emptyGrantSet).mockReturnValue({
    teamIds: [], sections: { exercises: false, trainings: false, guides: false },
  });
  vi.mocked(accessApi.listAllTeams).mockResolvedValue({ teams, lastDoc: null, hasMore: false });
  vi.mocked(accessApi.listGrantHolders).mockResolvedValue([
    { email: 'coach@example.com', grants: { teamIds: ['t1'], sections: { exercises: true, trainings: false, guides: false } } },
  ]);
  vi.mocked(accessApi.saveGrants).mockResolvedValue(undefined);
  vi.mocked(accessApi.removeAllGrants).mockResolvedValue(undefined);
});

describe('AccessManagerPage', () => {
  it('lists existing grant holders', async () => {
    render(<AccessManagerPage />);
    expect(await screen.findByText('coach@example.com')).toBeInTheDocument();
  });

  it('adds a person by email, lowercased, and opens an empty grant panel', async () => {
    render(<AccessManagerPage />);
    await screen.findByText('coach@example.com');
    fireEvent.change(screen.getByLabelText('Add person by email'), { target: { value: '  NEW@Example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }));
    expect(await screen.findByRole('heading', { name: 'new@example.com' })).toBeInTheDocument();
  });

  it('saves a diff of the toggled grants', async () => {
    render(<AccessManagerPage />);
    fireEvent.click(await screen.findByText('coach@example.com'));

    // grant U17 and trainings, revoke exercises
    fireEvent.click(await screen.findByRole('checkbox', { name: 'U17' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trainings' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exercises' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(accessApi.saveGrants).toHaveBeenCalledWith(
        'coach@example.com',
        { teamIds: ['t1', 't2'], sections: { exercises: false, trainings: true, guides: false } },
        { teamIds: ['t1'], sections: { exercises: true, trainings: false, guides: false } },
      )
    );
  });

  it('removes all access for a person', async () => {
    render(<AccessManagerPage />);
    fireEvent.click(await screen.findByText('coach@example.com'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove all access' }));
    await waitFor(() => expect(accessApi.removeAllGrants).toHaveBeenCalledWith('coach@example.com'));
  });

  it('surfaces an error if teams fail to load', async () => {
    vi.mocked(accessApi.listAllTeams).mockRejectedValueOnce(new Error('permission-denied'));
    render(<AccessManagerPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});
