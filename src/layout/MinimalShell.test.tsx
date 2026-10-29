import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MinimalShell } from './MinimalShell';
import { usePublishPageChrome } from './PageChrome';
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

function Publisher({ disabled = false, onSelect }: { disabled?: boolean; onSelect: () => void }) {
  usePublishPageChrome({ title: 'Club', mainAction: { label: 'Download export', onSelect, disabled } });
  return null;
}

describe('MinimalShell main action', () => {
  it('shows the main action a page publishes inside it', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <MinimalShell title="Club"><Publisher onSelect={onSelect} /></MinimalShell>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download export' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    rerender(
      <MemoryRouter>
        <MinimalShell title="Club"><Publisher onSelect={onSelect} disabled /></MinimalShell>
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'Download export' })).toBeDisabled();
  });

  it('uses v2 tokens, not the navy band', () => {
    const { container } = render(
      <MemoryRouter>
        <MinimalShell title="Club"><p>body</p></MinimalShell>
      </MemoryRouter>
    );
    expect(container.querySelector('.bg-navy')).toBeNull();
    expect(container.querySelector('.text-white')).toBeNull();
  });
});
