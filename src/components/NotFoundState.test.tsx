import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NotFoundState, isNotFoundError } from './NotFoundState';

describe('NotFoundState', () => {
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
});
