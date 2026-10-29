import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PhysicalTestGuideEditor } from './PhysicalTestGuideEditor';
import * as physicalTestGuideApi from './physicalTestGuideApi';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess } from '../test/authValue';
import { NoticeProvider } from '../components/Notice';
import { WithChrome } from '../test/chromeProbe';

vi.mock('./physicalTestGuideApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function renderEditor() {
  return render(
    <MemoryRouter>
      <NoticeProvider>
        <WithChrome>
          <PhysicalTestGuideEditor />
        </WithChrome>
      </NoticeProvider>
    </MemoryRouter>
  );
}

function signIn() {
  vi.mocked(useAuth).mockReturnValue(
    authValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com' },
      access: clubAdminAccess,
    })
  );
}

describe('PhysicalTestGuideEditor', () => {
  it('Done applies the protocol and Save in the toolbar saves the whole guide with a notice (B11)', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { uid: 'coach-uid' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com' },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(physicalTestGuideApi, 'getPhysicalTestGuide').mockResolvedValue({
      tests: [{ key: 'cmj', label: 'Countermovement Jump', protocol: 'Old protocol text' }],
      updatedBy: 'someone',
      updatedAt: null,
    });
    const updateSpy = vi.spyOn(physicalTestGuideApi, 'updatePhysicalTestGuide').mockResolvedValue(undefined);

    renderEditor();

    fireEvent.click(await screen.findByRole('button', { name: /Countermovement Jump/ }));
    fireEvent.change(screen.getByLabelText('Protocol'), { target: { value: 'Updated protocol text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        [{ key: 'cmj', label: 'Countermovement Jump', protocol: 'Updated protocol text' }],
        'coach-uid'
      )
    );
    expect(await screen.findByText('Physical test guide saved')).toBeInTheDocument();
  });

  it('Cancel on a test sheet with edits asks to discard (B11)', async () => {
    signIn();
    vi.spyOn(physicalTestGuideApi, 'getPhysicalTestGuide').mockResolvedValue({
      tests: [{ key: 'cmj', label: 'Countermovement Jump', protocol: 'Old protocol text' }],
      updatedBy: 'someone',
      updatedAt: null,
    });
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: /Countermovement Jump/ }));
    fireEvent.change(screen.getByLabelText('Protocol'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard changes?');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Countermovement Jump' })).not.toBeInTheDocument());
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('shows a skeleton until the guide loads, then one row per test', async () => {
    signIn();
    let resolveLoad: (v: Awaited<ReturnType<typeof physicalTestGuideApi.getPhysicalTestGuide>>) => void = () => {};
    vi.spyOn(physicalTestGuideApi, 'getPhysicalTestGuide').mockReturnValue(
      new Promise((resolve) => { resolveLoad = resolve; })
    );
    const { container } = renderEditor();
    expect(container.querySelectorAll('[data-skeleton-block]')).toHaveLength(8);
    resolveLoad({
      tests: [
        { key: 'cmj', label: 'Countermovement Jump', protocol: 'a' },
        { key: 'growth', label: 'Growth', protocol: 'b' },
      ],
      updatedBy: 'x',
      updatedAt: null,
    });
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Jump|Growth/ })).toHaveLength(2));
    expect(container.querySelectorAll('[data-skeleton-block]')).toHaveLength(0);
  });

  it('shows an error and no form when loading the guide fails', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { uid: 'coach-uid' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com' },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(physicalTestGuideApi, 'getPhysicalTestGuide').mockRejectedValue({ code: 'unavailable' });

    renderEditor();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the physical test guide.');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
  });
});
