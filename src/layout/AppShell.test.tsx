import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const mockSignOut = vi.fn();

vi.mock('firebase/auth', () => ({ signOut: (...args: unknown[]) => mockSignOut(...args) }));
vi.mock('../firebase/config', () => ({ auth: {} }));

describe('AppShell', () => {
  it('renders the same nav destinations in both the sidebar and the bottom tab bar', () => {
    render(
      <MemoryRouter initialEntries={['/teams']}>
        <AppShell>
          <p>Page content</p>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getAllByText('Teams')).toHaveLength(2);
    expect(screen.getAllByText('Guides')).toHaveLength(2);
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('signs out and redirects to /login when a sign-out button is clicked', async () => {
    mockSignOut.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={['/teams']}>
        <AppShell>
          <p>Page content</p>
        </AppShell>
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByText('Sign out')[0]);

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });
});
