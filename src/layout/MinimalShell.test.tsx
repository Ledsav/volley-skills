import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MinimalShell } from './MinimalShell';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';

const signOut = vi.hoisted(() => vi.fn());
vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../auth/useSignOut', () => ({
  useSignOut: () => ({ signOut, unsyncedDialog: <div>unsynced-dialog</div> }),
}));

beforeEach(() => vi.mocked(useAuth).mockReturnValue(authValue()));

describe('MinimalShell', () => {
  it('shows the title, email, content and signs out', () => {
    render(
      <MemoryRouter>
        <MinimalShell title="Test Club" actions={<span>extra</span>}><p>body</p></MinimalShell>
      </MemoryRouter>
    );
    expect(screen.getByText('Test Club')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByText('extra')).toBeInTheDocument();
    expect(screen.getByText('unsynced-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
  });
});
