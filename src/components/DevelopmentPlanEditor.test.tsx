import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DevelopmentPlanEditor } from './DevelopmentPlanEditor';
import type { DevelopmentPlan } from '../types/developmentPlan';

const emptyPlan: DevelopmentPlan = { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' };

describe('DevelopmentPlanEditor', () => {
  it('shows objectives read-only and hides Edit when isAdmin is false', () => {
    const plan: DevelopmentPlan = {
      shortTermObjectives: [{ objective: 'Improve serve', targetDate: '2026-12-01', status: 'In progress', coachComment: 'Good progress' }],
      seasonObjectives: [],
      generalNotes: 'Focused player',
    };

    render(<DevelopmentPlanEditor plan={plan} onSave={vi.fn()} isAdmin={false} />);

    expect(screen.getByText(/Improve serve/)).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('renders an objective as a structured card, not a single em-dash-joined line', () => {
    const plan: DevelopmentPlan = {
      shortTermObjectives: [
        { objective: 'Improve serve accuracy', targetDate: '2026-12-01', status: 'In progress', coachComment: 'Good progress' },
      ],
      seasonObjectives: [],
      generalNotes: '',
    };

    render(<DevelopmentPlanEditor plan={plan} onSave={vi.fn()} isAdmin={false} />);

    // The title stands alone — it's not glued to its metadata with " — ".
    expect(screen.getByText('Improve serve accuracy')).toBeInTheDocument();
    expect(screen.queryByText(/Improve serve accuracy —/)).not.toBeInTheDocument();
    expect(screen.getByText(/2026-12-01/)).toBeInTheDocument();
    expect(screen.getByText('Good progress')).toBeInTheDocument();
  });

  it('does not print a dangling separator when an objective has no coach comment', () => {
    const plan: DevelopmentPlan = {
      shortTermObjectives: [{ objective: 'Improve serve', targetDate: '2026-12-01', status: 'Not started', coachComment: '' }],
      seasonObjectives: [],
      generalNotes: '',
    };

    render(<DevelopmentPlanEditor plan={plan} onSave={vi.fn()} isAdmin={false} />);

    expect(screen.queryByText(/—\s*$/)).not.toBeInTheDocument();
  });

  it('adds a short-term objective and saves the whole plan', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<DevelopmentPlanEditor plan={emptyPlan} onSave={onSave} isAdmin={true} />);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('+ Add short-term objective'));
    fireEvent.change(screen.getByLabelText('Objective'), { target: { value: 'Improve serve accuracy' } });
    fireEvent.change(screen.getByLabelText('Target date'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Active' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        shortTermObjectives: [
          { objective: 'Improve serve accuracy', targetDate: '2026-12-01', status: 'Active', coachComment: '' },
        ],
        seasonObjectives: [],
        generalNotes: '',
      })
    );
  });

  it('shows a save error without discarding edits', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('nope'));
    render(<DevelopmentPlanEditor plan={emptyPlan} onSave={onSave} isAdmin={true} />);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  });

  it('discards edits when Cancel is clicked, instead of leaving them for the next edit session', () => {
    const plan: DevelopmentPlan = {
      shortTermObjectives: [{ objective: 'Improve serve', targetDate: '2026-12-01', status: 'Not started', coachComment: '' }],
      seasonObjectives: [],
      generalNotes: 'Original notes',
    };
    render(<DevelopmentPlanEditor plan={plan} onSave={vi.fn()} isAdmin={true} />);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Objective'), { target: { value: 'Abandoned edit' } });
    fireEvent.click(screen.getByText('Cancel'));

    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByLabelText('Objective')).toHaveValue('Improve serve');
  });
});
