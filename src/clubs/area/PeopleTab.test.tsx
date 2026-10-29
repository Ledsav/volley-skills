import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PeopleTab } from './PeopleTab';
import * as accessApi from '../../access/accessApi';
import * as membersApi from '../../access/membersApi';
import * as clubAdminApi from '../clubAdminApi';
import { useAuth } from '../../auth/AuthContext';
import { authValue, clubAdminAccess, testClub } from '../../test/authValue';
import type { Member } from '../../types/club';
import { NoticeProvider } from '../../components/Notice';
import { WithChrome } from '../../test/chromeProbe';
import { useMediaQuery } from '../../components/useMediaQuery';

vi.mock('../../access/accessApi');
vi.mock('../../access/membersApi', async (orig) => ({
  ...(await orig<typeof import('../../access/membersApi')>()),
  listMembers: vi.fn(), addMember: vi.fn(), setMemberRole: vi.fn(), removeFromClub: vi.fn(),
}));
vi.mock('../clubAdminApi');
vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../firebase/config', () => ({ db: {} }));
vi.mock('../../components/useMediaQuery', () => ({ useMediaQuery: vi.fn(() => false) }));

function renderTab() {
  return render(<NoticeProvider><WithChrome><PeopleTab /></WithChrome></NoticeProvider>);
}

async function openAddSheet() {
  fireEvent.click(screen.getByRole('button', { name: 'Add person' }));
  return screen.findByRole('dialog', { name: 'Add person' });
}

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
  vi.mocked(useMediaQuery).mockReturnValue(false);
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
    renderTab();
    const owner = await screen.findByRole('button', { name: /owner@example.com/ });
    expect(owner).toHaveTextContent('Owner');
    expect(owner).toHaveTextContent('Admin');
    expect(screen.getByRole('button', { name: /second@example.com/ })).toHaveTextContent('Admin');
    expect(screen.getByRole('button', { name: /coach@example.com/ })).toHaveTextContent('Member');
  });

  it('adds a person as member or admin', async () => {
    renderTab();
    await screen.findByText('coach@example.com');
    let dialog = await openAddSheet();
    expect(within(dialog).getByLabelText('Role')).toHaveValue('member');
    fireEvent.change(within(dialog).getByLabelText('Add person by email'), { target: { value: '  NEW@Example.com ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add person' }));
    await waitFor(() => expect(membersApi.addMember).toHaveBeenCalledWith('new@example.com', 'member', 'owner@example.com'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add person' })).toBeNull());
    dialog = await openAddSheet();
    fireEvent.change(within(dialog).getByLabelText('Add person by email'), { target: { value: 'boss@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Role'), { target: { value: 'admin' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add person' }));
    await waitFor(() => expect(membersApi.addMember).toHaveBeenCalledWith('boss@example.com', 'admin', 'owner@example.com'));
  });

  it("shows 'already a member' when adding an existing member", async () => {
    vi.mocked(membersApi.addMember).mockRejectedValue(new Error('already-member'));
    renderTab();
    await screen.findByText('coach@example.com');
    const dialog = await openAddSheet();
    fireEvent.change(within(dialog).getByLabelText('Add person by email'), { target: { value: 'coach@example.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add person' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('already a member');
  });

  it('Add person in the toolbar opens the add sheet', async () => {
    renderTab();
    await screen.findByText('coach@example.com');
    const dialog = await openAddSheet();
    expect(within(dialog).getByLabelText('Add person by email')).toBeInTheDocument();
  });

  it('Cancel after typing an email asks to discard', async () => {
    renderTab();
    await screen.findByText('coach@example.com');
    const dialog = await openAddSheet();
    fireEvent.change(within(dialog).getByLabelText('Add person by email'), { target: { value: 'x@example.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument();
  });

  it('Make admin is instant and offers Undo, which writes the previous role back', async () => {
    renderTab();
    await openPerson('coach@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Make admin' }));
    await waitFor(() => expect(membersApi.setMemberRole).toHaveBeenCalledWith('coach@example.com', 'admin'));
    expect(await screen.findByText('coach@example.com is now an admin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(membersApi.setMemberRole).toHaveBeenLastCalledWith('coach@example.com', 'member'));
  });

  it('demoting another admin offers Undo', async () => {
    renderTab();
    await openPerson('second@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Make member' }));
    await waitFor(() => expect(membersApi.setMemberRole).toHaveBeenCalledWith('second@example.com', 'member'));
    expect(await screen.findByText('second@example.com is now a member')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(membersApi.setMemberRole).toHaveBeenLastCalledWith('second@example.com', 'admin'));
  });

  it('a refused undo shows the role error and reloads', async () => {
    renderTab();
    await openPerson('coach@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Make admin' }));
    await screen.findByText('coach@example.com is now an admin');
    vi.mocked(membersApi.setMemberRole).mockRejectedValueOnce(new Error('permission-denied'));
    const calls = vi.mocked(membersApi.listMembers).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the role. Please try again.');
    await waitFor(() => expect(vi.mocked(membersApi.listMembers).mock.calls.length).toBeGreaterThan(calls));
  });

  it('on a narrow screen, choosing a person opens their access in a sheet', async () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    renderTab();
    await openPerson('coach@example.com');
    const dialog = await screen.findByRole('dialog', { name: 'coach@example.com' });
    expect(await within(dialog).findByRole('checkbox', { name: 'U15' })).toBeInTheDocument();
  });

  it('closing the person sheet with unsaved grants asks to discard', async () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    renderTab();
    await openPerson('coach@example.com');
    const dialog = await screen.findByRole('dialog', { name: 'coach@example.com' });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'U17' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(await screen.findByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument();
  });

  it('below lg, a failed grant save shows inside the open person sheet', async () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    vi.mocked(accessApi.saveGrants).mockRejectedValue(new Error('denied'));
    renderTab();
    await openPerson('coach@example.com');
    const dialog = await screen.findByRole('dialog', { name: 'coach@example.com' });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'U17' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('below lg, a failed role change and a refused undo show inside the person sheet', async () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    renderTab();
    await openPerson('coach@example.com');
    const dialog = await screen.findByRole('dialog', { name: 'coach@example.com' });
    vi.mocked(membersApi.setMemberRole).mockRejectedValueOnce(new Error('denied'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make admin' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not change the role. Please try again.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make admin' }));
    await screen.findByText('coach@example.com is now an admin');
    vi.mocked(membersApi.setMemberRole).mockRejectedValueOnce(new Error('denied'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not change the role. Please try again.');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('from lg, the same errors stay inline in the side panel', async () => {
    vi.mocked(accessApi.saveGrants).mockRejectedValue(new Error('denied'));
    renderTab();
    await openPerson('coach@example.com');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'U17' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a failed first load stops the skeleton', async () => {
    vi.mocked(membersApi.listMembers).mockRejectedValue(new Error('denied'));
    renderTab();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load people');
    await waitFor(() => expect(document.querySelectorAll('[data-skeleton-block]').length).toBe(0));
  });

  it('right-click on the owner offers Make member disabled with the reason', async () => {
    renderTab();
    fireEvent.contextMenu(await screen.findByRole('button', { name: /owner@example.com/ }), { clientX: 10, clientY: 10 });
    const menu = await screen.findByRole('menu', { name: 'Actions for owner@example.com' });
    expect(within(menu).getByRole('menuitem', { name: /Make member/ })).toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).getAllByText('The club owner stays an admin. Transfer ownership first.').length).toBeGreaterThan(0);
  });

  it('saves a diff of the toggled grants', async () => {
    renderTab();
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
    renderTab();
    await openPerson('coach@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Make admin' }));
    await waitFor(() => expect(membersApi.setMemberRole).toHaveBeenCalledWith('coach@example.com', 'admin'));
    fireEvent.click(await screen.findByRole('button', { name: 'Make member' }));
    await waitFor(() => expect(membersApi.setMemberRole).toHaveBeenCalledWith('coach@example.com', 'member'));
  });

  it('disables demote and remove for the owner, with the reason as hint', async () => {
    renderTab();
    await openPerson('owner@example.com');
    expect(screen.getByRole('button', { name: 'Make member' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove from club' })).toBeDisabled();
    expect(screen.getByText('The club owner stays an admin. Transfer ownership first.')).toBeInTheDocument();
  });

  it('disables demote and remove for the last admin, with the reason as hint', async () => {
    members = [m('solo@example.com', 'admin'), m('coach@example.com', 'member')];
    signInAs('gone@example.com');
    renderTab();
    await openPerson('solo@example.com');
    expect(screen.getByRole('button', { name: 'Make member' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove from club' })).toBeDisabled();
    expect(screen.getByText('A club needs at least one admin.')).toBeInTheDocument();
  });

  it('transfers ownership to another admin after confirmation', async () => {
    renderTab();
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
    renderTab();
    await openPerson('third@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Make owner' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Make third@example.com the club owner?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make owner' }));
    await waitFor(() => expect(clubAdminApi.transferOwnership).toHaveBeenCalledWith('third@example.com'));
  });

  it('Remove from club removes grants and membership after confirmation', async () => {
    renderTab();
    await openPerson('coach@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Remove from club' }));
    expect(membersApi.removeFromClub).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(membersApi.removeFromClub).toHaveBeenCalledWith('coach@example.com'));
  });

  it('asks before an admin demotes themselves, then reloads the page', async () => {
    const reload = vi.fn();
    const realLocation = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload } });
    try {
      vi.mocked(useAuth).mockReturnValue(authValue({
        access: clubAdminAccess, role: 'admin',
        appUser: { uid: 'u-2', email: 'second@example.com' },
        club: testClub({ ownerEmail: 'owner@example.com' }),
      }));
      renderTab();
      await openPerson('second@example.com');
      fireEvent.click(screen.getByRole('button', { name: 'Make member' }));
      const dialog = screen.getByRole('alertdialog', { name: 'Stop being an admin?' });
      expect(membersApi.setMemberRole).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Make me a member' }));
      await waitFor(() => expect(membersApi.setMemberRole).toHaveBeenCalledWith('second@example.com', 'member'));
      await waitFor(() => expect(reload).toHaveBeenCalled());
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
    }
  });

  it('refuses to add a malformed email', async () => {
    renderTab();
    await screen.findByText('coach@example.com');
    const dialog = await openAddSheet();
    for (const bad of ['coach', 'coach@example', 'co ach@example.com', '@example.com']) {
      fireEvent.change(within(dialog).getByLabelText('Add person by email'), { target: { value: bad } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add person' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Enter a valid email address.');
    }
    expect(membersApi.addMember).not.toHaveBeenCalled();
  });

  it('surfaces an error if data fails to load', async () => {
    vi.mocked(accessApi.listAllTeams).mockRejectedValueOnce(new Error('permission-denied'));
    renderTab();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });

  it('pages the team checklist with Load more (B9)', async () => {
    const c1 = { id: 'c1' } as never;
    vi.mocked(accessApi.listAllTeams)
      .mockResolvedValueOnce({ teams, lastDoc: c1, hasMore: true })
      .mockResolvedValueOnce({ teams: [{ id: 't3', name: 'U19' }], lastDoc: null, hasMore: false });
    renderTab();
    await openPerson('coach@example.com');
    fireEvent.click(await screen.findByRole('button', { name: 'Load more teams' }));
    expect(await screen.findByRole('checkbox', { name: 'U19' })).toBeInTheDocument();
    expect(accessApi.listAllTeams).toHaveBeenLastCalledWith(c1);
    expect(screen.queryByRole('button', { name: 'Load more teams' })).toBeNull();
  });

  it('the filter narrows only the loaded teams', async () => {
    vi.mocked(accessApi.listAllTeams).mockResolvedValue({ teams, lastDoc: null, hasMore: true });
    renderTab();
    await openPerson('coach@example.com');
    const filter = await screen.findByRole('searchbox', { name: 'Filter teams' });
    fireEvent.change(filter, { target: { value: '17' } });
    expect(screen.getByRole('checkbox', { name: 'U17' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'U15' })).toBeNull();
    fireEvent.change(filter, { target: { value: 'zz' } });
    expect(screen.getByText('No loaded team matches.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more teams' })).toBeInTheDocument();
  });

  it('keeps grants on teams not loaded yet when saving (B9)', async () => {
    vi.mocked(accessApi.listGrantHolders).mockResolvedValue([
      { email: 'coach@example.com', grants: { teamIds: ['t1', 't99'], sections: { exercises: false, trainings: false, guides: false } } },
    ]);
    renderTab();
    await openPerson('coach@example.com');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'U17' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(accessApi.saveGrants).toHaveBeenCalledWith(
      'coach@example.com',
      { teamIds: ['t1', 't99', 't2'], sections: { exercises: false, trainings: false, guides: false } },
      { teamIds: ['t1', 't99'], sections: { exercises: false, trainings: false, guides: false } },
    ));
  });

  it('loads the team list once, not on every reload', async () => {
    renderTab();
    await openPerson('coach@example.com');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'U17' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(accessApi.saveGrants).toHaveBeenCalled());
    await waitFor(() => expect(accessApi.listGrantHolders).toHaveBeenCalledTimes(2));
    expect(accessApi.listAllTeams).toHaveBeenCalledTimes(1);
  });

  it('a failed Load more keeps the loaded teams and says so', async () => {
    vi.mocked(accessApi.listAllTeams)
      .mockResolvedValueOnce({ teams, lastDoc: null, hasMore: true })
      .mockRejectedValueOnce(new Error('offline'));
    renderTab();
    await openPerson('coach@example.com');
    fireEvent.click(await screen.findByRole('button', { name: 'Load more teams' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load more teams. Please try again.');
    expect(screen.getByRole('checkbox', { name: 'U15' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more teams' })).toBeEnabled();
  });

  it('marks the selected person', async () => {
    renderTab();
    await openPerson('coach@example.com');
    expect(screen.getByRole('button', { name: /coach@example.com/ })).toHaveAttribute('aria-current', 'true');
  });
});
