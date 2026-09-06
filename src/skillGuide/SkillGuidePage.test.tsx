import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillGuidePage } from './SkillGuidePage';
import * as skillGuideApi from './skillGuideApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./skillGuideApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

describe('SkillGuidePage', () => {
  it('loads the guide, edits a range description, and saves', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    vi.spyOn(skillGuideApi, 'getSkillGuide').mockResolvedValue({
      skills: [
        {
          key: 'serve',
          label: 'Serve',
          ranges: [{ min: 1, max: 3, description: 'Inconsistent' }],
          howToEvaluate: 'Count % of serves in.',
        },
      ],
      updatedBy: 'someone',
      updatedAt: null,
    });
    const updateSpy = vi.spyOn(skillGuideApi, 'updateSkillGuide').mockResolvedValue(undefined);

    render(<SkillGuidePage />);

    await screen.findByText('Serve');
    fireEvent.change(screen.getByLabelText('1-3'), { target: { value: 'Updated description' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            key: 'serve',
            ranges: [{ min: 1, max: 3, description: 'Updated description' }],
          }),
        ],
        'coach-uid'
      )
    );
  });

  it('shows an error message when the save is rejected', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    vi.spyOn(skillGuideApi, 'getSkillGuide').mockResolvedValue({
      skills: [
        {
          key: 'serve',
          label: 'Serve',
          ranges: [{ min: 1, max: 3, description: 'Inconsistent' }],
          howToEvaluate: 'Count % of serves in.',
        },
      ],
      updatedBy: 'someone',
      updatedAt: null,
    });
    vi.spyOn(skillGuideApi, 'updateSkillGuide').mockRejectedValue({ code: 'permission-denied' });

    render(<SkillGuidePage />);

    await screen.findByText('Serve');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('shows an error and no form when loading the guide fails', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    vi.spyOn(skillGuideApi, 'getSkillGuide').mockRejectedValue({ code: 'unavailable' });

    render(<SkillGuidePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the skill guide.');
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });

  it('disables Save until the guide has loaded', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    let resolveLoad: (value: { skills: never[]; updatedBy: string; updatedAt: null }) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveLoad = resolve;
    });
    vi.spyOn(skillGuideApi, 'getSkillGuide').mockReturnValue(pending as ReturnType<typeof skillGuideApi.getSkillGuide>);

    render(<SkillGuidePage />);

    expect(screen.getByText('Save')).toBeDisabled();

    resolveLoad({ skills: [], updatedBy: '', updatedAt: null });
    await waitFor(() => expect(screen.getByText('Save')).not.toBeDisabled());
  });
});
