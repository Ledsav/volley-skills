import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Access } from '../auth/access';
import type { Team } from '../types/team';
import { Shortcuts } from './Shortcuts';

function mkTeam(id: string, name: string): Team {
  return {
    id, name, ageGroup: name, season: '2026-27', description: '', notes: '', adminEmails: [],
    developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' }, createdBy: '', createdAt: null,
  };
}

function LocationProbe() {
  const loc = useLocation();
  const pending = (loc.state as { pendingAction?: string } | null)?.pendingAction ?? '';
  return <p data-testid="loc">{`${loc.pathname}${loc.search}|${pending}`}</p>;
}

function renderShortcuts(teams: Team[], access: Access) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Shortcuts teams={teams} access={access} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const none: Access = { isClubAdmin: false, sections: { exercises: false, trainings: false, guides: false } };
const all: Access = { isClubAdmin: true, sections: { exercises: true, trainings: true, guides: true } };

describe('Shortcuts', () => {
  it('shows only the shortcuts the person can use', () => {
    renderShortcuts([], { ...none, sections: { ...none.sections, trainings: true } });
    expect(screen.getByRole('button', { name: 'New training' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New match' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New exercise' })).not.toBeInTheDocument();
  });

  it('shows no section without any shortcut', () => {
    renderShortcuts([], none);
    expect(screen.queryByRole('heading', { name: 'Shortcuts' })).not.toBeInTheDocument();
  });

  it('New match with one team goes straight to its Matches tab', async () => {
    renderShortcuts([mkTeam('t1', 'U17')], none);
    fireEvent.click(screen.getByRole('button', { name: 'New match' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/teams/t1?tab=matches|new-match');
  });

  it('New match with several teams asks which team first', async () => {
    renderShortcuts([mkTeam('t1', 'U17'), mkTeam('t2', 'U15')], none);
    fireEvent.click(screen.getByRole('button', { name: 'New match' }));
    expect(screen.getByRole('dialog', { name: 'Choose a team' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /U15/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/teams/t2?tab=matches|new-match');
  });

  it('New exercise opens the exercise form', async () => {
    renderShortcuts([], all);
    fireEvent.click(screen.getByRole('button', { name: 'New exercise' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/exercises|new-exercise');
  });
});
