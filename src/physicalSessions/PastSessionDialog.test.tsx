import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as playersApi from '../players/playersApi';
import * as physicalTestsApi from '../players/physicalTestsApi';
import * as testingSessionsApi from './testingSessionsApi';
import { PastSessionDialog } from './PastSessionDialog';

vi.mock('./testingSessionsApi');
vi.mock('../players/playersApi');
vi.mock('../players/physicalTestsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const entry = (playerId: string, testType: string, status: 'complete' | 'in_progress', resultTestId: string | null = null) => ({
  id: `${playerId}__${testType}`,
  playerId,
  testType,
  status,
  data: {},
  resultTestId,
  updatedAt: null,
});

describe('PastSessionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(testingSessionsApi.listSessionEntries).mockResolvedValue([
      entry('p1', 'cmj', 'complete', 't1'),
      entry('p1', 'sprint10m', 'in_progress'),
      entry('p2', 'broadJump', 'complete', 't2'),
    ] as never);
    vi.mocked(playersApi.getPlayer).mockImplementation(async (_team, id) => ({ id, fullName: id === 'p1' ? 'Ilaria Lanzoni' : 'Chiara Corradini' }) as never);
    vi.mocked(physicalTestsApi.getPhysicalTest).mockImplementation(async (_team, _player, id) =>
      (id === 't1' ? { id, testType: 'cmj', bestCm: 34 } : { id, testType: 'broadJump', bestCm: 181 }) as never,
    );
  });

  it('shows each tested player with their results from that session', async () => {
    render(<PastSessionDialog teamId="team-1" session={{ id: 's1', date: '2026-09-16' } as never} onClose={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Physical testing · 2026-09-16' })).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Results' });
    const [anna, chloe] = within(list).getAllByRole('listitem');
    expect(anna).toHaveTextContent('Chiara Corradini');
    expect(anna).toHaveTextContent('Standing Broad Jump');
    expect(anna).toHaveTextContent('181 cm');
    expect(chloe).toHaveTextContent('Ilaria Lanzoni');
    expect(chloe).toHaveTextContent('34 cm');
    expect(chloe).toHaveTextContent('Not finished');
    expect(screen.getByText('2 players tested')).toBeInTheDocument();
  });

  it('says so when nobody was tested', async () => {
    vi.mocked(testingSessionsApi.listSessionEntries).mockResolvedValue([]);
    render(<PastSessionDialog teamId="team-1" session={{ id: 's1', date: '2026-09-16' } as never} onClose={vi.fn()} onDeleted={vi.fn()} />);
    expect(await screen.findByText('No results were recorded in this session.')).toBeInTheDocument();
  });

  it('shows an inline error when results cannot be loaded', async () => {
    vi.mocked(testingSessionsApi.listSessionEntries).mockRejectedValue(new Error('offline'));
    render(<PastSessionDialog teamId="team-1" session={{ id: 's1', date: '2026-09-16' } as never} onClose={vi.fn()} onDeleted={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this session. Please try again.');
  });

  it('deletes the session after confirming how many results go with it', async () => {
    const onDeleted = vi.fn();
    vi.mocked(testingSessionsApi.deleteSession).mockResolvedValue(undefined);
    render(<PastSessionDialog teamId="team-1" session={{ id: 's1', date: '2026-09-16' } as never} onClose={vi.fn()} onDeleted={onDeleted} />);
    await screen.findByRole('list', { name: 'Results' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete this session?' })).toHaveTextContent('2 results');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(testingSessionsApi.deleteSession).toHaveBeenCalledWith('team-1', 's1'));
    expect(onDeleted).toHaveBeenCalled();
  });
});
