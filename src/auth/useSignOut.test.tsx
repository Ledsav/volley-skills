import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_CLUB_KEY, storeClub } from '../clubs/activeClub';
import { signOutAndClearLocalData } from '../firebase/signOut';
import { clearSearchData } from '../search/useSearchData';
import { useSignOut } from './useSignOut';

vi.mock('../search/useSearchData', async (orig) => ({ ...(await orig<typeof import('../search/useSearchData')>()), clearSearchData: vi.fn() }));
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn(async () => 'signedOut') }));

function Harness() {
  const { signOut, unsyncedDialog } = useSignOut();
  return (
    <>
      <button onClick={signOut}>go</button>
      {unsyncedDialog}
    </>
  );
}

describe('useSignOut', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks the sign-out helper to clear AI settings and drafts once it proceeds', async () => {
    render(<Harness />);
    await act(async () => screen.getByText('go').click());
    expect(signOutAndClearLocalData).toHaveBeenCalledWith({ force: false, beforeSignOut: expect.any(Function) });
  });

  it('forgets the active club and AI settings in the pre-sign-out step', async () => {
    storeClub('club-1');
    render(<Harness />);
    await act(async () => screen.getByText('go').click());
    vi.mocked(signOutAndClearLocalData).mock.calls[0][0]?.beforeSignOut?.();
    expect(localStorage.getItem(ACTIVE_CLUB_KEY)).toBeNull();
  });

  it('forgets a signing draft in the pre-sign-out step', async () => {
    localStorage.setItem('vcb.signDraft', '{"kind":"signup"}');
    render(<Harness />);
    await act(async () => screen.getByText('go').click());
    vi.mocked(signOutAndClearLocalData).mock.calls[0][0]?.beforeSignOut?.();
    expect(localStorage.getItem('vcb.signDraft')).toBeNull();
  });

  it('sign-out clears recents', async () => {
    sessionStorage.setItem('vcb.searchRecents', '[{"id":"t1"}]');
    render(<Harness />);
    await act(async () => screen.getByText('go').click());
    vi.mocked(signOutAndClearLocalData).mock.calls[0][0]?.beforeSignOut?.();
    expect(sessionStorage.getItem('vcb.searchRecents')).toBeNull();
  });

  it('sign-out clears the search cache and recents', async () => {
    sessionStorage.setItem('vcb.searchRecents', '[{"id":"t1"}]');
    render(<Harness />);
    await act(async () => screen.getByText('go').click());
    vi.mocked(signOutAndClearLocalData).mock.calls[0][0]?.beforeSignOut?.();
    expect(clearSearchData).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('vcb.searchRecents')).toBeNull();
  });

  it('shows the unsynced dialog when the helper reports unsynced writes', async () => {
    vi.mocked(signOutAndClearLocalData).mockResolvedValueOnce('unsynced');
    render(<Harness />);
    await act(async () => screen.getByText('go').click());
    expect(screen.getByText('Unsynced scouting actions')).toBeInTheDocument();
  });
});
