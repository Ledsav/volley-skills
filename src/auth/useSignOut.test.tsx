import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAiLocalData } from '../matches/text/aiSettings';
import { signOutAndClearLocalData } from '../firebase/signOut';
import { useSignOut } from './useSignOut';

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
    expect(signOutAndClearLocalData).toHaveBeenCalledWith({ force: false, beforeSignOut: clearAiLocalData });
  });

  it('shows the unsynced dialog when the helper reports unsynced writes', async () => {
    vi.mocked(signOutAndClearLocalData).mockResolvedValueOnce('unsynced');
    render(<Harness />);
    await act(async () => screen.getByText('go').click());
    expect(screen.getByText('Unsynced scouting actions')).toBeInTheDocument();
  });
});
