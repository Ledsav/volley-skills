import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhysicalTestingSection } from './PhysicalTestingSection';
import * as physicalTestsApi from './physicalTestsApi';
import { useAuth } from '../auth/AuthContext';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';

vi.mock('./physicalTestsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const cmjEntry: PhysicalTest = {
  id: 'test-1',
  testType: 'cmj',
  attemptsCm: [30, 34, 32],
  bestCm: 34,
  date: '2026-09-01',
  notes: '',
  recordedBy: 'coach-uid',
  createdAt: null,
};

describe('PhysicalTestingSection', () => {
  it('shows the latest value per quality, and "No data yet" where none exists', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockImplementation((_teamId, _playerId, testType: PhysicalTestType) =>
      Promise.resolve(testType === 'cmj' ? cmjEntry : null)
    );

    render(<PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={true} />);

    expect(await screen.findByText(/34 cm — 2026-09-01/)).toBeInTheDocument();
    expect(screen.getAllByText('No data yet').length).toBe(7);
  });

  it('hides "Add new" when isAdmin is false', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);

    render(<PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={false} />);

    await waitFor(() => expect(screen.getAllByText('No data yet').length).toBe(8));
    expect(screen.queryByText('Add new')).not.toBeInTheDocument();
  });

  it('opens the add-test dialog for the clicked quality and refreshes on save', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);

    render(<PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={true} />);

    await waitFor(() => expect(screen.getAllByText('No data yet').length).toBe(8));
    fireEvent.click(screen.getAllByText('Add new')[0]);

    expect(await screen.findByLabelText('Height (cm)')).toBeInTheDocument();
  });
});
