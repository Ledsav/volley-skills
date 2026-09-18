import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AccessManagerPage } from './AccessManagerPage';
import * as accessApi from './accessApi';
import * as interestApi from '../interest/interestApi';

vi.mock('./accessApi');
vi.mock('../interest/interestApi');
vi.mock('../firebase/config', () => ({ db: {} }));

const teams = [
  { id: 't1', name: 'U15' },
  { id: 't2', name: 'U17' },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AccessManagerPage />
    </MemoryRouter>
  );
}

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
  vi.mocked(interestApi.countUnreviewedInterestSignups).mockResolvedValue(0);
  vi.mocked(interestApi.listInterestSignups).mockResolvedValue({ signups: [], lastDoc: null, hasMore: false });
  vi.mocked(interestApi.markInterestSignupReviewed).mockResolvedValue(undefined);
});

describe('AccessManagerPage', () => {
  it('lists existing grant holders', async () => {
    renderPage();
    expect(await screen.findByText('coach@example.com')).toBeInTheDocument();
  });

  it('adds a person by email, lowercased, and opens an empty grant panel', async () => {
    renderPage();
    await screen.findByText('coach@example.com');
    fireEvent.change(screen.getByLabelText('Add person by email'), { target: { value: '  NEW@Example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }));
    expect(await screen.findByRole('heading', { name: 'new@example.com' })).toBeInTheDocument();
  });

  it('saves a diff of the toggled grants', async () => {
    renderPage();
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
    renderPage();
    fireEvent.click(await screen.findByText('coach@example.com'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove all access' }));
    await waitFor(() => expect(accessApi.removeAllGrants).toHaveBeenCalledWith('coach@example.com'));
  });

  it('surfaces an error if teams fail to load', async () => {
    vi.mocked(accessApi.listAllTeams).mockRejectedValueOnce(new Error('permission-denied'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });

  it('always shows the access requests list, even when none are new', async () => {
    vi.mocked(interestApi.listInterestSignups).mockResolvedValue({
      signups: [{ id: 's1', name: 'Ana', email: 'ana@example.com', role: 'coach', reviewed: true, createdAt: null }],
      lastDoc: null, hasMore: false,
    });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Access requests' })).toBeInTheDocument();
    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });

  it('opens the grant editor for a requester and marks the request reviewed', async () => {
    vi.mocked(interestApi.countUnreviewedInterestSignups).mockResolvedValue(1);
    vi.mocked(interestApi.listInterestSignups).mockResolvedValue({
      signups: [{ id: 's1', name: 'Ana', email: 'Ana@Example.com', role: 'guardian', reviewed: false, createdAt: null }],
      lastDoc: null, hasMore: false,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Grant access' }));
    expect(await screen.findByRole('heading', { name: 'ana@example.com' })).toBeInTheDocument();
    await waitFor(() => expect(interestApi.markInterestSignupReviewed).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(screen.queryByText('1 new')).not.toBeInTheDocument());
  });
});
