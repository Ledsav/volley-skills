import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useTakePendingAction, withPendingAction } from './pendingAction';

function Page({ run }: { run: () => void }) {
  useTakePendingAction('new-team', run);
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search + JSON.stringify(l.state)}</div>;
}

describe('useTakePendingAction', () => {
  it('runs once and clears the state', async () => {
    const run = vi.fn();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/teams', search: '?a=1', ...withPendingAction('new-team') }]}>
        <Page run={run} />
      </MemoryRouter>
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('/teams?a=1null')).toBeInTheDocument();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('ignores a different action', () => {
    const run = vi.fn();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/teams', ...withPendingAction('new-match') }]}>
        <Page run={run} />
      </MemoryRouter>
    );
    expect(run).not.toHaveBeenCalled();
  });
});
