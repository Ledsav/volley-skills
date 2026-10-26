import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';
import { NotFoundState, isNotFoundError } from './NotFoundState';

vi.mock('../auth/AuthContext');

describe('NotFoundState', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(authValue());
  });

  it('renders title, message and back link', () => {
    render(
      <MemoryRouter>
        <NotFoundState title="Match not found" message="It may have been deleted." backTo="/teams/t1" backLabel="Back to team" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Match not found' })).toBeInTheDocument();
    expect(screen.getByText('It may have been deleted.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to team' })).toHaveAttribute('href', '/teams/t1');
  });

  it('treats permission-denied and not-found as not found', () => {
    expect(isNotFoundError({ code: 'permission-denied' })).toBe(true);
    expect(isNotFoundError({ code: 'not-found' })).toBe(true);
    expect(isNotFoundError({ code: 'unavailable' })).toBe(false);
    expect(isNotFoundError(new Error('x'))).toBe(false);
  });

  it('hints at another club when the person has several', () => {
    const switchClub = vi.fn();
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        switchClub,
        memberships: [
          { clubId: 'club-1', role: 'member', clubName: 'Test Club', status: 'active' },
          { clubId: 'club-2', role: 'member', clubName: 'Other Club', status: 'active' },
        ],
      })
    );
    render(
      <MemoryRouter>
        <NotFoundState title="Team not found" backTo="/teams" backLabel="Back" />
      </MemoryRouter>,
    );
    expect(screen.getByText('This may belong to another of your clubs.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Other Club' }));
    expect(switchClub).toHaveBeenCalledWith('club-2');
  });

  it('gives no club hint for a single club', () => {
    render(
      <MemoryRouter>
        <NotFoundState title="Team not found" backTo="/teams" backLabel="Back" />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/another of your clubs/)).not.toBeInTheDocument();
  });
});
