import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhysicalTestGuideEditor } from './PhysicalTestGuideEditor';
import * as physicalTestGuideApi from './physicalTestGuideApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./physicalTestGuideApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

describe('PhysicalTestGuideEditor', () => {
  it('loads the guide, edits a protocol, and saves', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    vi.spyOn(physicalTestGuideApi, 'getPhysicalTestGuide').mockResolvedValue({
      tests: [{ key: 'cmj', label: 'Countermovement Jump', protocol: 'Old protocol text' }],
      updatedBy: 'someone',
      updatedAt: null,
    });
    const updateSpy = vi.spyOn(physicalTestGuideApi, 'updatePhysicalTestGuide').mockResolvedValue(undefined);

    render(<PhysicalTestGuideEditor />);

    await screen.findByText('Countermovement Jump');
    fireEvent.change(screen.getByLabelText('Protocol'), { target: { value: 'Updated protocol text' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        [{ key: 'cmj', label: 'Countermovement Jump', protocol: 'Updated protocol text' }],
        'coach-uid'
      )
    );
  });

  it('shows an error and no form when loading the guide fails', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    vi.spyOn(physicalTestGuideApi, 'getPhysicalTestGuide').mockRejectedValue({ code: 'unavailable' });

    render(<PhysicalTestGuideEditor />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the physical test guide.');
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });
});
