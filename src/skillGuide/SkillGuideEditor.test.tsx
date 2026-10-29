import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillGuideEditor } from './SkillGuideEditor';
import { GuidesPage } from '../admin/GuidesPage';
import * as skillGuideApi from './skillGuideApi';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess } from '../test/authValue';
import { NoticeProvider } from '../components/Notice';
import { WithChrome } from '../test/chromeProbe';

vi.mock('./skillGuideApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../physicalTestGuide/PhysicalTestGuideEditor', () => ({
  PhysicalTestGuideEditor: () => <div>Physical test guide content</div>,
}));

const SERVE = {
  key: 'serve' as const,
  label: 'Serve',
  ranges: [
    { min: 1, max: 3, description: 'Inconsistent' },
    { min: 4, max: 6, description: 'Regular' },
  ],
  howToEvaluate: 'Count % of serves in.',
};

function renderEditor() {
  return render(
    <MemoryRouter>
      <NoticeProvider>
        <WithChrome>
          <SkillGuideEditor />
        </WithChrome>
      </NoticeProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useAuth).mockReturnValue(
    authValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com' },
      access: clubAdminAccess,
    })
  );
  vi.mocked(skillGuideApi.getSkillGuide).mockResolvedValue({ skills: [SERVE], updatedBy: 'someone', updatedAt: null });
  vi.mocked(skillGuideApi.updateSkillGuide).mockResolvedValue(undefined);
});

async function editServe(text = 'Updated description') {
  fireEvent.click(await screen.findByRole('button', { name: /Serve/ }));
  fireEvent.change(screen.getByLabelText('1-3'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
}

describe('SkillGuideEditor', () => {
  it('lists the skills and opens an editor per skill', async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: /Serve/ }));
    expect(screen.getByRole('dialog', { name: 'Serve' })).toBeInTheDocument();
    expect(screen.getByLabelText('1-3')).toHaveValue('Inconsistent');
  });

  it('Done applies the edit and Save in the toolbar saves the whole guide with a notice (B11)', async () => {
    renderEditor();
    await editServe();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(skillGuideApi.updateSkillGuide).toHaveBeenCalledWith(
        [expect.objectContaining({ key: 'serve', ranges: [{ min: 1, max: 3, description: 'Updated description' }, SERVE.ranges[1]] })],
        'coach-uid'
      )
    );
    expect(await screen.findByText('Skill guide saved')).toBeInTheDocument();
  });

  it('shows an error message when the save is rejected', async () => {
    vi.mocked(skillGuideApi.updateSkillGuide).mockRejectedValue({ code: 'permission-denied' });
    renderEditor();
    await editServe();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the skill guide.');
  });

  it('Cancel on a skill sheet with edits asks to discard (B11)', async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: /Serve/ }));
    fireEvent.change(screen.getByLabelText('1-3'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard changes?');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Serve' })).not.toBeInTheDocument());
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Serve/ }));
    expect(screen.getByLabelText('1-3')).toHaveValue('Inconsistent');
  });

  it('shows an error and no form when loading the guide fails', async () => {
    vi.mocked(skillGuideApi.getSkillGuide).mockRejectedValue({ code: 'unavailable' });
    renderEditor();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the skill guide.');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
  });

  it('disables Save until the guide has loaded and something changed, even for a guide never saved', async () => {
    let resolveLoad: (v: { skills: (typeof SERVE)[]; updatedBy: string; updatedAt: null }) => void = () => {};
    vi.mocked(skillGuideApi.getSkillGuide).mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve as typeof resolveLoad;
      }) as ReturnType<typeof skillGuideApi.getSkillGuide>
    );
    renderEditor();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    resolveLoad({ skills: [SERVE], updatedBy: '', updatedAt: null });
    await screen.findByRole('button', { name: /Serve/ });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await editServe();
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('Save is disabled for a stored guide until something changes', async () => {
    renderEditor();
    await screen.findByRole('button', { name: /Serve/ });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await editServe();
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('keeps the range band colours in the sheet', async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: /Serve/ }));
    expect(screen.getByLabelText('4-6').parentElement).toHaveClass('border-orange');
  });

  it('warns before unload while there are unsaved changes', async () => {
    renderEditor();
    await screen.findByRole('button', { name: /Serve/ });
    const before = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);
    await editServe();
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(true);
  });

  it('switching guide tabs keeps an unsaved skill edit', async () => {
    render(
      <MemoryRouter>
        <NoticeProvider>
          <WithChrome>
            <GuidesPage />
          </WithChrome>
        </NoticeProvider>
      </MemoryRouter>
    );
    await editServe('Edited across tabs');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Physical test guide' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Skill guide' }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Serve/ }));
    expect(screen.getByLabelText('1-3')).toHaveValue('Edited across tabs');
  });
});
