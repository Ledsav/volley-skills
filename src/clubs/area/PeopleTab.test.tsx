import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PeopleTab } from './PeopleTab';
import * as accessApi from '../../access/accessApi';
import * as membersApi from '../../access/membersApi';
import * as clubAdminApi from '../clubAdminApi';
import { useAuth } from '../../auth/AuthContext';
import { authValue, clubAdminAccess, testClub } from '../../test/authValue';
import type { Member } from '../../types/club';

vi.mock('../../access/accessApi');
vi.mock('../../access/membersApi', async (orig) => ({
  ...(await orig<typeof import('../../access/membersApi')>()),
  listMembers: vi.fn(), addMember: vi.fn(), setMemberRole: vi.fn(), removeFromClub: vi.fn(),
}));
vi.mock('../clubAdminApi');
vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../firebase/config', () => ({ db: {} }));

const teams = [{ id: 't1', name: 'U15' }, { id: 't2', name: 'U17' }];
const m = (email: string, role: 'admin' | 'member'): Member => ({ email, role, clubId: 'club-1', addedBy: 'x', addedAt: null as never });
let members: Member[];

function signInAs(ownerEmail: string) {
  vi.mocked(useAuth).mockReturnValue(authValue({
    access: clubAdminAccess, role: 'admin',
    appUser: { uid: 'u-1', email: 'owner@example.com' },
    club: testClub({ ownerEmail }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  members = [m('owner@example.com', 'admin'), m('second@example.com', 'admin'), m('coach@example.com', 'member')];
  signInAs('owner@example.com');
  vi.mocked(accessApi.emptyGrantSet).mockReturnValue({ teamIds: [], sections: { exercises: false, trainings: false, guides: false } });
  vi.mocked(accessApi.listAllTeams).mockResolvedValue({ teams, lastDoc: null, hasMore: false });
  vi.mocked(accessApi.listGrantHolders).mockResolvedValue([
    { email: 'coach@example.com', grants: { teamIds: ['t1'], sections: { exercises: true, trainings: false, guides: false } } },
  ]);
  vi.mocked(accessApi.saveGrants).mockResolvedValue(undefined);
  vi.mocked(membersApi.listMembers).mockImplementation(async () => members);
  vi.mocked(membersApi.addMember).mockResolvedValue(undefined);
  vi.mocked(membersApi.setMemberRole).mockResolvedValue(undefined);
  vi.mocked(membersApi.removeFromClub).mockResolvedValue(undefined);
  vi.mocked(clubAdminApi.transferOwnership).mockResolvedValue(undefined);
});

async function openPerson(email: string) {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(email) }));
}

describe('PeopleTab', () => {
  it('lists every member with a role badge and the owner marked', async () => {
    render(<PeopleTab />);
    const owner = await screen.findByRole('button', { name: /owner@example.com/ });
    expect(owner).toHaveTextContent('Owner');
    expect(owner).toHaveTextContent('Admin');
    expect(screen.getByRole('button', { name: /second@example.com/ })).toHaveTextContent('Admin');
    expect(screen.getByRole('button', { name: /coach@example.com/ })).toHaveTextContent('Member');
  });

  it('adds a person as member or admin', async () => {
    render(<PeopleTab />);
    await screen.findByText('coach@example.com');
    expect(screen.getByLabelText('Role')).toHaveValue('member');
    fireEvent.change(screen.getByLabelText('Add person by email'), { target: { value: '  NEW@Example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }));
    await waitFor(() => expect(membersApi.addMember).toHaveBeenCalledWith('new@example.com', 'member', 'owner@example.com'));
    fireEvent.change(screen.getByLabelText('Add person by email'), { target: { value: 'boss@example.com' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }));
    await waitFor(() => expect(membersApi.addMember).toHaveBeenCalledWith('boss@example.com', 'admin', 'owner@example.com'));
  });

  it("shows 'already a member' when adding an existing member", async () => {
    vi.mocked(membersApi.addMember).mockRejectedValue(new Error('already-member'));
    render(<PeopleTab />);
    await screen.findByText('coach@example.com');
    fireEvent.change(screen.getByLabelText('Add person by email'), { target: { value: 'coach@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already a member');
  });

  it('saves a diff of the toggled grants', async () => {
    render(<PeopleTab />);
    await openPerson('coach@example.com');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'U17' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trainings' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exercises' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(accessApi.saveGrants).toHaveBeenCalledWith(
      'coach@example.com',
      { teamIds: ['t1', 't2'], sections: { exercises: false, trainings: true, guides: false } },
      { teamIds: ['t1'], sections: { exercises: true, trainings: false, guides: false } },
    ));
  });

  it('changes a member to admin and back', async () => {
    vi.mocked(membersApi.setMemberRole).mockImplementation(async (email, role) => {
      members = members.map((x) => (x.email === email ? { ...x, role } : x));
    });
    render(<PeopleTab />);
    await openPerson('coach@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Make admin' }));
    await waitFor(() => expect(membersApi.setMemberRole).toHaveBeenCalledWith('coach@example.com', 'admin'));
    fireEvent.click(await screen.findByRole('button', { name: 'Make member' }));
    await waitFor(() => expect(membersApi.setMemberRole).toHaveBeenCalledWith('coach@example.com', 'member'));
  });

  it('disables demote and remove for the owner, with the reason as hint', async () => {
    render(<PeopleTab />);
    await openPerson('owner@example.com');
    expect(screen.getByRole('button', { name: 'Make member' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove from club' })).toBeDisabled();
    expect(screen.getByText('The club owner stays an admin. Transfer ownership first.')).toBeInTheDocument();
  });

  it('disables demote and remove for the last admin, with the reason as hint', async () => {
    members = [m('solo@example.com', 'admin'), m('coach@example.com', 'member')];
    signInAs('gone@example.com');
    render(<PeopleTab />);
    await openPerson('solo@example.com');
    expect(screen.getByRole('button', { name: 'Make member' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove from club' })).toBeDisabled();
    expect(screen.getByText('A club needs at least one admin.')).toBeInTheDocument();
  });

  it('transfers ownership to another admin after confirmation', async () => {
    render(<PeopleTab />);
    await openPerson('second@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Make owner' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Make second@example.com the club owner?' });
    expect(clubAdminApi.transferOwnership).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make owner' }));
    await waitFor(() => expect(clubAdminApi.transferOwnership).toHaveBeenCalledWith('second@example.com'));
  });

  it('lets a non-owner admin make another admin the owner', async () => {
    signInAs('owner@example.com');
    vi.mocked(useAuth).mockReturnValue(authValue({
      access: clubAdminAccess, role: 'admin',
      appUser: { uid: 'u-2', email: 'second@example.com' },
      club: testClub({ ownerEmail: 'owner@example.com' }),
    }));
    members = [...members, m('third@example.com', 'admin')];
    render(<PeopleTab />);
    await openPerson('third@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Make owner' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Make third@example.com the club owner?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make owner' }));
    await waitFor(() => expect(clubAdminApi.transferOwnership).toHaveBeenCalledWith('third@example.com'));
  });

  it('Remove from club removes grants and membership after confirmation', async () => {
    render(<PeopleTab />);
    await openPerson('coach@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Remove from club' }));
    expect(membersApi.removeFromClub).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(membersApi.removeFromClub).toHaveBeenCalledWith('coach@example.com'));
  });

  it('surfaces an error if data fails to load', async () => {
    vi.mocked(accessApi.listAllTeams).mockRejectedValueOnce(new Error('permission-denied'));
    render(<PeopleTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});
