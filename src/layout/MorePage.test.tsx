import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MorePage } from './MorePage';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess, testClub } from '../test/authValue';

const mockSignOut = vi.fn();
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: (...args: unknown[]) => mockSignOut(...args) }));
vi.mock('../auth/AuthContext');
vi.mock('../interest/interestApi', () => ({ countUnreviewedInterestSignups: () => Promise.resolve(2) }));

function renderMore() {
  return render(
    <MemoryRouter>
      <MorePage />
    </MemoryRouter>
  );
}

const links = (name: string) =>
  within(screen.getByRole('region', { name })).getAllByRole('link').map((l) => [l.textContent?.replace(/\d+.*$/, '').trim(), l.getAttribute('href')]);

describe('MorePage', () => {
  beforeEach(() => {
    mockSignOut.mockReset();
    vi.mocked(useAuth).mockReturnValue(authValue({ access: clubAdminAccess, isPlatformAdmin: true, club: testClub({ name: 'Volley Club Belair' }) }));
  });

  it('lists the club and platform pages the bottom bar has no room for, under the same groups as the sidebar', async () => {
    renderMore();
    expect(screen.getByRole('heading', { name: 'Volley Club Belair' })).toBeInTheDocument();
    expect(links('Club')).toEqual([['Guides', '/admin/guides'], ['Members & settings', '/club']]);
    expect(links('Platform')).toEqual([['Clubs & sign-ups', '/platform']]);
    await waitFor(() => expect(screen.getByRole('link', { name: /Clubs & sign-ups/ })).toHaveTextContent('2'));
    expect(links('Account')).toEqual([['Settings', '/settings'], ['Terms & privacy', '/legal/terms']]);
  });

  it('never repeats a bottom-bar page', () => {
    renderMore();
    for (const name of ['Home', 'Teams', 'Trainings', 'Exercises']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
  });

  it('shows a coach only the account section', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ access: { isClubAdmin: false, sections: { exercises: true, trainings: true, guides: false } } }));
    renderMore();
    expect(screen.queryByRole('region', { name: 'Club' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Platform' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Account' })).toBeInTheDocument();
  });

  it('switches club when there is more than one', () => {
    const switchClub = vi.fn();
    vi.mocked(useAuth).mockReturnValue(authValue({
      switchClub,
      club: testClub({ name: 'Test Club' }),
      memberships: [
        { clubId: 'club-1', role: 'member', clubName: 'Test Club', status: 'active' },
        { clubId: 'club-2', role: 'member', clubName: 'Other Club', status: 'active' },
      ],
    }));
    renderMore();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Other Club' }));
    expect(switchClub).toHaveBeenCalledWith('club-2');
  });

  it('signs out', async () => {
    mockSignOut.mockResolvedValue('signedOut');
    renderMore();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });
});
