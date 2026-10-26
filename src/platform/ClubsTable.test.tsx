import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubsTable } from './ClubsTable';
import * as platformApi from './platformApi';
import { authValue, testClub } from '../test/authValue';
import { useAuth } from '../auth/AuthContext';

vi.mock('./platformApi');
vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('../auth/AuthContext');
vi.mock('../components/Notice', () => ({ useNotify: () => vi.fn() }));

const ts = (y: number, m: number, d: number) => Timestamp.fromDate(new Date(y, m, d, 12));

const active = testClub({ id: 'c1', name: 'Alpha VC', country: 'BE', ownerEmail: 'owner@alpha.be', status: 'active',
  createdAt: ts(2026, 0, 5), legal: { versionKey: '2026-09', acceptedAt: ts(2026, 0, 5), acceptedBy: 'owner@alpha.be' } });
const ending = testClub({ id: 'c2', name: 'Beta VC', status: 'terminating',
  termination: { requestedAt: null, requestedBy: null, effectiveAt: ts(2026, 10, 30), retrievalEndsAt: ts(2026, 11, 30) } });
const pending = testClub({ id: 'c3', name: 'Gamma VC', status: 'pending' });

const page = (clubs = [active, ending, pending], hasMore = false) =>
  ({ clubs, lastDoc: { id: 'last' } as never, hasMore });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(authValue({ appUser: { uid: 'u', email: 'Op@Example.com' } as never }));
  vi.mocked(platformApi.listClubs).mockResolvedValue(page());
});

const row = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('ClubsTable', () => {
  it('shows name, country, owner, status, created date, accepted legal version and contract dates', async () => {
    render(<ClubsTable />);
    const a = within(await screen.findByRole('row', { name: /Alpha VC/ }));
    expect(a.getByText('BE')).toBeInTheDocument();
    expect(a.getByText('owner@alpha.be')).toBeInTheDocument();
    expect(a.getByText('Active')).toBeInTheDocument();
    expect(a.getByText(new Date(2026, 0, 5, 12).toLocaleDateString())).toBeInTheDocument();
    expect(a.getByText('2026-09')).toBeInTheDocument();
    const b = within(row('Beta VC'));
    expect(b.getByText('Ending')).toBeInTheDocument();
    expect(b.getByText(new Date(2026, 10, 30, 12).toLocaleDateString())).toBeInTheDocument();
    expect(b.getByText(new Date(2026, 11, 30, 12).toLocaleDateString())).toBeInTheDocument();
  });

  it('filters by status', async () => {
    render(<ClubsTable />);
    await screen.findByText('Alpha VC');
    const select = screen.getByLabelText('Status');
    expect(within(select).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['All', 'Pending', 'Active', 'Paused', 'Ending', 'Deleted']);
    fireEvent.change(select, { target: { value: 'suspended' } });
    await waitFor(() => expect(platformApi.listClubs).toHaveBeenLastCalledWith({ status: 'suspended', after: null }));
  });

  it('loads more with the cursor when hasMore', async () => {
    vi.mocked(platformApi.listClubs)
      .mockResolvedValueOnce(page([active], true))
      .mockResolvedValueOnce(page([pending], false));
    render(<ClubsTable />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Gamma VC')).toBeInTheDocument();
    expect(platformApi.listClubs).toHaveBeenLastCalledWith({ status: null, after: { id: 'last' } });
    expect(screen.getByText('Alpha VC')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('renders no link into club data', async () => {
    const { container } = render(<ClubsTable />);
    await screen.findByText('Alpha VC');
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it("shows each row's actions from clubActions, secondary ones in a More menu", async () => {
    render(<ClubsTable />);
    await screen.findByText('Alpha VC');
    const a = within(row('Alpha VC'));
    expect(a.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(a.queryByRole('button', { name: 'End contract' })).not.toBeInTheDocument();
    fireEvent.click(a.getByRole('button', { name: /More actions/ }));
    expect(screen.getByRole('menuitem', { name: 'End contract' })).toBeInTheDocument();
    expect(within(row('Beta VC')).getByRole('button', { name: 'Reinstate' })).toBeInTheDocument();
  });

  it('refreshes the row after a status change, as the lowercased operator', async () => {
    vi.mocked(platformApi.changeClubStatus).mockResolvedValue(undefined);
    render(<ClubsTable />);
    await screen.findByText('Gamma VC');
    fireEvent.click(within(row('Gamma VC')).getByRole('button', { name: 'Activate' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(within(row('Gamma VC')).getByText('Active')).toBeInTheDocument());
    expect(platformApi.changeClubStatus).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: 'c3', from: 'pending', to: 'active' }), 'op@example.com');
  });

  it('shows an error when the list cannot load', async () => {
    vi.mocked(platformApi.listClubs).mockRejectedValue(new Error('x'));
    render(<ClubsTable />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load clubs.');
  });
});
